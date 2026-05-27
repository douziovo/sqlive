package com.douzi.sqlive.service.metadata;

import com.douzi.sqlive.dto.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.stereotype.Component;

import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.*;

@Component
@Slf4j
public class MetadataExtractor {

    private static final Set<String> CONSTRAINT_KEYWORDS = Set.of(
            "PRIMARY", "FOREIGN", "UNIQUE", "CHECK", "CONSTRAINT");

    private record SqliteMaster(
            List<Map<String, Object>> tableRows,
            List<Map<String, Object>> indexRows,
            List<String> tableNames
    ) {}

    private SqliteMaster querySqliteMaster(JdbcTemplate jdbc) {
        List<Map<String, Object>> tableRows = new ArrayList<>();
        List<Map<String, Object>> indexRows = new ArrayList<>();
        List<String> tableNames = new ArrayList<>();

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT name, type, sql, tbl_name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name");

        for (var row : rows) {
            String type = (String) row.get("type");
            switch (type) {
                case "table" -> {
                    tableRows.add(row);
                    String name = (String) row.get("name");
                    if (!isInvalidIdentifier(name)) tableNames.add(name);
                }
                case "index" -> {
                    if (row.get("sql") != null) indexRows.add(row);
                }
            }
        }
        return new SqliteMaster(tableRows, indexRows, tableNames);
    }

    // ── Public API ───────────────────────────────────────────

    public List<TableSchema> extractAllTables(JdbcTemplate jdbc) {
        var master = querySqliteMaster(jdbc);
        return getAllTables(jdbc, master.tableRows);
    }

    public List<IndexInfo> extractIndexes(JdbcTemplate jdbc) {
        var master = querySqliteMaster(jdbc);
        return getIndexes(jdbc, master.indexRows);
    }

    public List<ViewInfo> extractViews(JdbcTemplate jdbc) {
        return getViews(jdbc);
    }

    public List<TriggerInfo> extractTriggers(JdbcTemplate jdbc) {
        return getTriggers(jdbc);
    }

    public List<ForeignKeyInfo> extractForeignKeys(JdbcTemplate jdbc) {
        var master = querySqliteMaster(jdbc);
        return getForeignKeys(jdbc, master.tableNames);
    }

    public TableSchema extractTableSchema(ResultSet rs, String tableName) throws SQLException {
        TableSchema schema = new TableSchema();
        schema.setName(tableName);
        List<String> columns = new ArrayList<>();
        Map<String, String> columnTypes = new LinkedHashMap<>();
        List<Map<String, Object>> dataList = new ArrayList<>();
        ResultSetMetaData metaData = rs.getMetaData();
        int colCount = metaData.getColumnCount();
        for (int i = 1; i <= colCount; i++) {
            String colName = metaData.getColumnLabel(i);
            String colType = metaData.getColumnTypeName(i);
            if (colType == null || colType.isEmpty()) colType = "N/A";
            columns.add(colName);
            columnTypes.put(colName, colType.toUpperCase());
        }
        while (rs.next()) {
            Map<String, Object> row = new LinkedHashMap<>();
            for (String colName : columns) {
                row.put(colName, rs.getObject(colName));
            }
            dataList.add(row);
        }
        schema.setColumns(columns);
        schema.setColumnTypes(columnTypes);
        schema.setData(dataList);
        return schema;
    }

    // ── Private extraction ────────────────────────────────────

    private List<TableSchema> getAllTables(JdbcTemplate jdbc, List<Map<String, Object>> tableRows) {
        List<TableSchema> tables = new ArrayList<>();
        for (Map<String, Object> row : tableRows) {
            String tableName = (String) row.get("name");
            String createSql = (String) row.get("sql");
            if (isInvalidIdentifier(tableName)) {
                log.warn("Skipping table with invalid name: {}", tableName);
                continue;
            }
            Map<String, String> constraintsMap = extractConstraintsFromSql(createSql);
            try {
                TableSchema schema = jdbc.query(
                    "SELECT * FROM " + quoteIdentifier(tableName),
                    (ResultSetExtractor<TableSchema>) rs -> extractTableSchema(rs, tableName));
                if (!constraintsMap.isEmpty()) {
                    Map<String, String> enrichedTypes = new LinkedHashMap<>(schema.getColumnTypes());
                    enrichedTypes.replaceAll((col, type) -> {
                        String constraint = constraintsMap.getOrDefault(col, "");
                        return constraint.isEmpty() ? type : type + " | " + constraint;
                    });
                    schema.setColumnTypes(enrichedTypes);
                }
                tables.add(schema);
            } catch (Exception e) {
                log.error("Failed to extract schema for table {}", tableName, e);
            }
        }
        return tables;
    }

    private List<IndexInfo> getIndexes(JdbcTemplate jdbc, List<Map<String, Object>> indexRows) {
        List<IndexInfo> indexes = new ArrayList<>();
        for (Map<String, Object> row : indexRows) {
            IndexInfo info = new IndexInfo();
            info.setName((String) row.get("name"));
            info.setTableName((String) row.get("tbl_name"));
            String sql = (String) row.get("sql");
            info.setSql(sql);
            info.setUnique(sql != null && sql.toUpperCase().contains("UNIQUE"));
            String indexName = (String) row.get("name");
            if (isInvalidIdentifier(indexName)) {
                log.warn("Skipping index with invalid name: {}", indexName);
                continue;
            }
            List<String> columns = jdbc.query(
                "PRAGMA index_info(" + quoteIdentifier(indexName) + ")",
                (rs, rowNum) -> rs.getString("name"));
            info.setColumns(columns);
            indexes.add(info);
        }
        return indexes;
    }

    private List<ViewInfo> getViews(JdbcTemplate jdbc) {
        return jdbc.query(
            "SELECT name, sql FROM sqlite_master WHERE type='view' AND sql IS NOT NULL ORDER BY name",
            (rs, rowNum) -> {
                ViewInfo info = new ViewInfo();
                info.setName(rs.getString("name"));
                info.setSql(rs.getString("sql"));
                return info;
            });
    }

    private List<TriggerInfo> getTriggers(JdbcTemplate jdbc) {
        return jdbc.query(
            "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger' AND sql IS NOT NULL ORDER BY tbl_name, name",
            (rs, rowNum) -> {
                TriggerInfo info = new TriggerInfo();
                info.setName(rs.getString("name"));
                info.setTableName(rs.getString("tbl_name"));
                info.setSql(rs.getString("sql"));
                return info;
            });
    }

    private List<ForeignKeyInfo> getForeignKeys(JdbcTemplate jdbc, List<String> tableNames) {
        List<ForeignKeyInfo> foreignKeys = new ArrayList<>();
        for (String tableName : tableNames) {
            try {
                List<Map<String, Object>> fkRows = jdbc.queryForList(
                    "PRAGMA foreign_key_list(" + quoteIdentifier(tableName) + ")");
                for (Map<String, Object> row : fkRows) {
                    ForeignKeyInfo fk = new ForeignKeyInfo();
                    fk.setName(tableName + "_fk_" + row.get("id"));
                    fk.setFromTable(tableName);
                    fk.setFromColumn((String) row.get("from"));
                    fk.setToTable((String) row.get("table"));
                    fk.setToColumn((String) row.get("to"));
                    foreignKeys.add(fk);
                }
            } catch (Exception e) {
                log.debug("PRAGMA foreign_key_list failed for table {}: {}", tableName, e.getMessage());
            }
        }
        return foreignKeys;
    }

    // ── Constraint parsing ────────────────────────────────────

    private Map<String, String> extractConstraintsFromSql(String createSql) {
        Map<String, String> constraints = new HashMap<>();
        if (createSql == null) return constraints;
        int firstParen = createSql.indexOf('(');
        int lastParen = createSql.lastIndexOf(')');
        if (firstParen == -1 || lastParen == -1) return constraints;
        String content = createSql.substring(firstParen + 1, lastParen);
        for (String def : splitColumnDefs(content)) {
            def = def.trim();
            if (def.isEmpty()) continue;
            String[] parts = def.split("\\s+", 3);
            if (CONSTRAINT_KEYWORDS.contains(parts[0].toUpperCase())) continue;
            String colName = parts[0].replace("\"", "").replace("`", "");
            if (parts.length >= 3) {
                constraints.put(colName, parts[2]);
            } else if (parts.length == 2) {
                constraints.put(colName, "");
            }
        }
        return constraints;
    }

    private List<String> splitColumnDefs(String content) {
        List<String> defs = new ArrayList<>();
        int depth = 0;
        int start = 0;
        for (int i = 0; i < content.length(); i++) {
            char c = content.charAt(i);
            if (c == '(') depth++;
            else if (c == ')') depth--;
            else if (c == ',' && depth == 0) {
                defs.add(content.substring(start, i));
                start = i + 1;
            }
        }
        defs.add(content.substring(start));
        return defs;
    }

    // ── Identifier utilities ──────────────────────────────────

    private static boolean isInvalidIdentifier(String identifier) {
        if (identifier == null || identifier.isEmpty()) return true;
        return !identifier.matches("^[a-zA-Z_][a-zA-Z0-9_]*$");
    }

    static String quoteIdentifier(String identifier) {
        if (isInvalidIdentifier(identifier)) {
            throw new IllegalArgumentException("Invalid identifier: " + identifier);
        }
        return "\"" + identifier + "\"";
    }
}
