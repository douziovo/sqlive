package com.douzi.sqlive.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class TableSchema {
	private String name;
	private List<String> columns;
	private Map<String, String> columnTypes;
	private List<Map<String, Object>> data;
}