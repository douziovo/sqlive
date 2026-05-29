package com.douzi.sqlive.service;

import com.douzi.sqlive.dto.*;
import com.douzi.sqlive.service.database.DatabasePoolManager;
import com.douzi.sqlive.service.metadata.MetadataExtractor;
import com.douzi.sqlive.service.sql.SqlParser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.*;

@Service
@Slf4j
public class SqlExecutionService {

    private final DatabasePoolManager poolManager;
    private final SqlParser sqlParser;
    private final MetadataExtractor metadataExtractor;

    public SqlExecutionService(DatabasePoolManager poolManager, SqlParser sqlParser,
                                MetadataExtractor metadataExtractor) {
        this.poolManager = poolManager;
        this.sqlParser = sqlParser;
        this.metadataExtractor = metadataExtractor;
    }

    public SqlResponse execute(String sqlScript, String dbName, boolean reset) {
        SqlResponse response = new SqlResponse();
        JdbcTemplate jdbc = poolManager.getOrCreateJdbcTemplate(dbName);

        try {
            if (reset) {
                clearDatabase(jdbc);
            }
            List<SqlParser.SqlStatement> statements = sqlParser.parseStatementsPrecise(sqlScript);
            List<TableSchema> allQueryResults = new ArrayList<>();
            int statementCount = 0;
            long startTime = System.nanoTime();

            for (SqlParser.SqlStatement s : statements) {
                if (s.sql().trim().isEmpty()) continue;
                try {
                    jdbc.execute((Statement stmt) -> {
                        @SuppressWarnings("SqlSourceToSinkFlow")
                        boolean hasResultSet = stmt.execute(s.sql());
                        if (hasResultSet) {
                            try (ResultSet rs = stmt.getResultSet()) {
                                String resultName = allQueryResults.isEmpty()
                                    ? "查询结果"
                                    : "查询结果 " + (allQueryResults.size() + 1);
                                allQueryResults.add(metadataExtractor.extractTableSchema(rs, resultName));
                            }
                        }
                        return null;
                    });
                    statementCount++;
                } catch (Exception e) {
                    log.warn("SQL execution failed at line {}: {}", s.startLine(), e.getMessage());
                    String rawMsg = e.getMessage() != null ? e.getMessage() : "unknown error";
                    String cleanMsg = rawMsg.replace("[SQLITE_ERROR] SQL error or missing database ", "");
                    return SqlResponse.error(cleanMsg,
                            sqlParser.locateErrorLine(s.sql(), s.startLine(), rawMsg));
                }
            }

            List<SqlResponse.CanonicalStatement> canonicalList = new ArrayList<>();
            for (SqlParser.SqlStatement s : statements) {
                if (s.sql().trim().isEmpty()) continue;
                SqlResponse.CanonicalStatement cs = new SqlResponse.CanonicalStatement();
                cs.setStart(s.startPos());
                cs.setEnd(s.startPos() + s.sql().length());
                canonicalList.add(cs);
            }

            long durationMs = (System.nanoTime() - startTime) / 1_000_000;

            SqlResponse.DataPayload payload = new SqlResponse.DataPayload();
            payload.setTables(metadataExtractor.extractAllTables(jdbc));
            payload.setQueryResults(allQueryResults);
            payload.setIndexes(metadataExtractor.extractIndexes(jdbc));
            payload.setViews(metadataExtractor.extractViews(jdbc));
            payload.setTriggers(metadataExtractor.extractTriggers(jdbc));
            payload.setForeignKeys(metadataExtractor.extractForeignKeys(jdbc));
            payload.setCanonicalStatements(canonicalList);

            ExecutionMetadata meta = new ExecutionMetadata();
            meta.setDurationMs(durationMs);
            meta.setStatementCount(statementCount);
            payload.setMetadata(meta);

            response.setSuccess(true);
            response.setData(payload);

        } catch (Exception e) {
            log.error("Failed to execute SQL script", e);
            return SqlResponse.error("Internal server error", 0);
        }

        return response;
    }

    private void clearDatabase(JdbcTemplate jdbc) {
        var allObjects = jdbc.queryForList(
            "SELECT name, type FROM sqlite_master WHERE type IN ('view','trigger','table') AND name NOT LIKE 'sqlite_%'");

        // Separate objects by type
        List<String> viewNames = new ArrayList<>();
        List<String> triggerNames = new ArrayList<>();
        List<String> tableNames = new ArrayList<>();
        for (var obj : allObjects) {
            String type = (String) obj.get("type");
            if (type == null) continue;
            switch (type) {
                case "view" -> viewNames.add((String) obj.get("name"));
                case "trigger" -> triggerNames.add((String) obj.get("name"));
                case "table" -> tableNames.add((String) obj.get("name"));
            }
        }

        // Topological sort of tables by FK dependency (leaf-first = referencing before referenced)
        List<String> tableDropOrder = topologicalSortTables(jdbc, tableNames);

        // Execute drops: views first, triggers second, tables in topological order
        jdbc.execute((Connection con) -> {
            try (Statement stmt = con.createStatement()) {
                for (String name : viewNames) {
                    stmt.execute("DROP VIEW IF EXISTS " + stmt.enquoteIdentifier(name, false));
                }
                for (String name : triggerNames) {
                    stmt.execute("DROP TRIGGER IF EXISTS " + stmt.enquoteIdentifier(name, false));
                }
                for (String name : tableDropOrder) {
                    stmt.execute("DROP TABLE IF EXISTS " + stmt.enquoteIdentifier(name, false));
                }
            }
            return null;
        });
    }

    private List<String> topologicalSortTables(JdbcTemplate jdbc, List<String> tableNames) {
        if (tableNames.isEmpty()) return List.of();

        List<ForeignKeyInfo> foreignKeys = metadataExtractor.extractForeignKeys(jdbc);

        // Build adjacency list: table -> tables it references (FK toTable)
        Map<String, List<String>> adjacency = new HashMap<>();
        Map<String, Integer> inDegree = new HashMap<>();
        for (String tn : tableNames) {
            adjacency.put(tn, new ArrayList<>());
            inDegree.put(tn, 0);
        }

        for (ForeignKeyInfo fk : foreignKeys) {
            String from = fk.getFromTable();
            String to = fk.getToTable();
            if (adjacency.containsKey(from) && adjacency.containsKey(to)) {
                adjacency.get(from).add(to);
                inDegree.merge(to, 1, Integer::sum);
            }
        }

        // Kahn's algorithm for topological sort
        Queue<String> queue = new LinkedList<>();
        for (String tn : tableNames) {
            if (inDegree.get(tn) == 0) {
                queue.add(tn);
            }
        }

        List<String> sorted = new ArrayList<>();
        while (!queue.isEmpty()) {
            String node = queue.poll();
            sorted.add(node);
            for (String dep : adjacency.get(node)) {
                inDegree.merge(dep, -1, Integer::sum);
                if (inDegree.get(dep) == 0) {
                    queue.add(dep);
                }
            }
        }

        if (sorted.size() < tableNames.size()) {
            List<String> remaining = new ArrayList<>(tableNames);
            remaining.removeAll(sorted);
            log.warn("FK cycle detected among tables: {}. Dropping tables in arbitrary order.", remaining);
            sorted.addAll(remaining);
        }
        return sorted;
    }
}
