package com.douzi.sqlive.dto;

import lombok.Data;
import java.util.List;

@Data
public class SqlResponse {
    private boolean success;
    private DataPayload data;
    private ErrorPayload error;

    @Data
    public static class DataPayload {
        private List<TableSchema> tables;
        private List<TableSchema> queryResults;
        private List<IndexInfo> indexes;
        private List<ViewInfo> views;
        private List<TriggerInfo> triggers;
        private List<ForeignKeyInfo> foreignKeys;
        private ExecutionMetadata metadata;
    }

    public static SqlResponse error(String message, int line) {
        SqlResponse response = new SqlResponse();
        response.setSuccess(false);
        response.setError(new ErrorPayload(message, line));
        return response;
    }
}
