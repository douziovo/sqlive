package com.douzi.sqlive.dto;

import lombok.Data;

@Data
@SuppressWarnings("unused")
public class TriggerInfo {
    private String name;
    private String tableName;
    private String sql;
}
