package com.douzi.sqlive.dto;

import lombok.Data;

@Data
@SuppressWarnings("unused")
public class ForeignKeyInfo {
    private String name;
    private String fromTable;
    private String fromColumn;
    private String toTable;
    private String toColumn;
}
