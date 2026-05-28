package com.douzi.sqlive.dto;

import lombok.Data;

@Data
public class ExecutionMetadata {
    private long durationMs;
    private int statementCount;
}
