package com.douzi.sqlive.service.metadata;

import com.douzi.sqlive.dto.TableSchema;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Failure / edge paths of {@link MetadataExtractor} driven by a mocked
 * JdbcTemplate: invalid identifiers in sqlite_master, PRAGMA failures,
 * null result-set column types, and degenerate CREATE TABLE SQL.
 */
class MetadataExtractorFailurePathsTest {

	private final MetadataExtractor extractor = new MetadataExtractor();

	private static Map<String, Object> row(String type, String name, String sql) {
		var row = new HashMap<String, Object>();
		row.put("type", type);
		row.put("name", name);
		row.put("sql", sql);
		row.put("tbl_name", name);
		return row;
	}

	@Test
	void tableWithNulCharacterInNameIsSkipped() {
		JdbcTemplate jdbc = mock(JdbcTemplate.class);
		when(jdbc.queryForList(anyString())).thenReturn(List.of(row("table", "bad\0name", "CREATE TABLE bad (a)")));

		var tables = extractor.extractAllTables(jdbc);
		assertTrue(tables.isEmpty(), "table with NUL in name must be skipped");
	}

	@Test
	void perTableSchemaQueryFailureIsLoggedAndSkipped() {
		JdbcTemplate jdbc = mock(JdbcTemplate.class);
		when(jdbc.queryForList(anyString()))
				.thenReturn(List.of(row("table", "ok_table", "CREATE TABLE ok_table (a INTEGER)")));
		when(jdbc.query(anyString(), any(ResultSetExtractor.class)))
				.thenThrow(new RuntimeException("table locked"));

		var tables = extractor.extractAllTables(jdbc);
		assertTrue(tables.isEmpty(), "failed schema read must not propagate");
	}

	@Test
	void tableWithoutParenthesesInCreateSqlStillExtracted() {
		JdbcTemplate jdbc = mock(JdbcTemplate.class);
		when(jdbc.queryForList(anyString()))
				.thenReturn(List.of(row("table", "t1", null),
						row("table", "t2", "no parens at all")));
		when(jdbc.query(anyString(), any(ResultSetExtractor.class))).thenAnswer(inv -> new TableSchema());

		var tables = extractor.extractAllTables(jdbc);
		assertEquals(2, tables.size(), "degenerate CREATE SQL must not break extraction");
	}

	@Test
	void indexWithInvalidNameIsSkippedBeforePragma() {
		JdbcTemplate jdbc = mock(JdbcTemplate.class);
		when(jdbc.queryForList(anyString()))
				.thenReturn(List.of(row("index", "bad\0idx", "CREATE INDEX bad ON t(a)")));

		var indexes = extractor.extractIndexes(jdbc);
		assertTrue(indexes.isEmpty());
	}

	@Test
	void autoIndexWithoutSqlIsIgnored() {
		JdbcTemplate jdbc = mock(JdbcTemplate.class);
		when(jdbc.queryForList(anyString()))
				.thenReturn(List.of(row("index", "sqlite_autoindex", null)));

		var indexes = extractor.extractIndexes(jdbc);
		assertTrue(indexes.isEmpty(), "index rows without sql must be dropped early");
	}

	private static TableSchema schemaWithTypes() {
		var schema = new TableSchema();
		schema.setColumnTypes(new java.util.LinkedHashMap<>());
		return schema;
	}

	@Test
	void createSqlWithUnclosedParenIsTolerated() {
		JdbcTemplate jdbc = mock(JdbcTemplate.class);
		when(jdbc.queryForList(anyString()))
				.thenReturn(List.of(row("table", "t_unclosed", "(a INTEGER")));
		when(jdbc.query(anyString(), any(ResultSetExtractor.class))).thenAnswer(inv -> schemaWithTypes());

		assertEquals(1, extractor.extractAllTables(jdbc).size());
	}

	@Test
	void createSqlWithEmptyColumnDefIsTolerated() {
		JdbcTemplate jdbc = mock(JdbcTemplate.class);
		when(jdbc.queryForList(anyString()))
				.thenReturn(List.of(row("table", "t_gap", "CREATE TABLE t_gap (a INTEGER,,b INTEGER)")));
		when(jdbc.query(anyString(), any(ResultSetExtractor.class))).thenAnswer(inv -> schemaWithTypes());

		assertEquals(1, extractor.extractAllTables(jdbc).size());
	}

	@Test
	void foreignKeyPragmaFailureSkipsTableWithoutFailing() {
		JdbcTemplate jdbc = mock(JdbcTemplate.class);
		when(jdbc.queryForList(anyString()))
				.thenReturn(List.of(row("table", "t", "CREATE TABLE t (a)")))
				.thenThrow(new RuntimeException("PRAGMA failed"));

		var fks = extractor.extractForeignKeys(jdbc);
		assertTrue(fks.isEmpty());
	}

	@Test
	void nullOrEmptyColumnTypeNameFallsBackToNA() throws Exception {
		ResultSet rs = mock(ResultSet.class);
		ResultSetMetaData meta = mock(ResultSetMetaData.class);
		when(rs.getMetaData()).thenReturn(meta);
		when(meta.getColumnCount()).thenReturn(2);
		when(meta.getColumnLabel(1)).thenReturn("a");
		when(meta.getColumnLabel(2)).thenReturn("b");
		when(meta.getColumnTypeName(1)).thenReturn(null);
		when(meta.getColumnTypeName(2)).thenReturn("");
		when(rs.next()).thenReturn(false);

		TableSchema schema = extractor.extractTableSchema(rs, "query result");
		assertEquals(List.of("a", "b"), schema.getColumns());
		assertEquals("N/A", schema.getColumnTypes().get("a"));
		assertEquals("N/A", schema.getColumnTypes().get("b"));
		assertTrue(schema.getData().isEmpty());
	}

	@Test
	void queryResultRowsAreMappedByColumnLabel() throws Exception {
		ResultSet rs = mock(ResultSet.class);
		ResultSetMetaData meta = mock(ResultSetMetaData.class);
		when(rs.getMetaData()).thenReturn(meta);
		when(meta.getColumnCount()).thenReturn(1);
		when(meta.getColumnLabel(1)).thenReturn("value");
		when(meta.getColumnTypeName(1)).thenReturn("INTEGER");
		when(rs.next()).thenReturn(true, false);
		when(rs.getObject("value")).thenReturn(42);

		TableSchema schema = extractor.extractTableSchema(rs, "查询结果");
		assertEquals(1, schema.getData().size());
		assertEquals(42, schema.getData().getFirst().get("value"));
	}
}
