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
import java.util.ArrayList;
import java.util.List;

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

    @SuppressWarnings("SqlSourceToSinkFlow")
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

            long durationMs = (System.nanoTime() - startTime) / 1_000_000;

            SqlResponse.DataPayload payload = new SqlResponse.DataPayload();
            payload.setTables(metadataExtractor.extractAllTables(jdbc));
            payload.setQueryResults(allQueryResults);
            payload.setIndexes(metadataExtractor.extractIndexes(jdbc));
            payload.setViews(metadataExtractor.extractViews(jdbc));
            payload.setTriggers(metadataExtractor.extractTriggers(jdbc));
            payload.setForeignKeys(metadataExtractor.extractForeignKeys(jdbc));

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

        jdbc.execute((Connection con) -> {
            try (Statement stmt = con.createStatement()) {
                stmt.execute("PRAGMA foreign_keys = OFF");

                for (var obj : allObjects) {
                    String type = (String) obj.get("type");
                    if (type == null) continue;
                    String name = stmt.enquoteIdentifier((String) obj.get("name"), false);
                    switch (type) {
                        case "view" -> stmt.execute("DROP VIEW IF EXISTS " + name);
                        case "trigger" -> stmt.execute("DROP TRIGGER IF EXISTS " + name);
                        case "table" -> stmt.execute("DROP TABLE IF EXISTS " + name);
                    }
                }

                stmt.execute("PRAGMA foreign_keys = ON");
            }
            return null;
        });
    }
}
