package com.douzi.sqlive.dto;

import lombok.Data;
import java.util.List;

@Data
@SuppressWarnings("unused")
public class IndexInfo {
    private String name;
    private String tableName;
    private boolean unique;
    private List<String> columns;
    private String sql;
}
