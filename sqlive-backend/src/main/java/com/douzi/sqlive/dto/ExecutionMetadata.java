package com.douzi.sqlive.dto;

import lombok.Data;

@Data
@SuppressWarnings("unused")
public class ExecutionMetadata {
    private long durationMs;
    private int statementCount;
}
