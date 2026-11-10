package com.douzi.sqlive.service;

import com.douzi.sqlive.config.PoolProperties;
import com.douzi.sqlive.dto.SqlResponse;
import com.douzi.sqlive.service.database.DatabasePoolManager;
import com.douzi.sqlive.service.database.DatabasePoolManager.PoolEntry;
import com.douzi.sqlive.service.metadata.MetadataExtractor;
import com.douzi.sqlive.service.sql.SqlParser;
import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.StatementCallback;
import org.springframework.test.util.ReflectionTestUtils;

import java.sql.Connection;
import java.sql.Statement;
import java.sql.SQLException;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

/**
 * Failure paths of {@link SqlExecutionService} that need a mocked pool or
 * JdbcTemplate: session-recreation flagging, internal errors from
 * clearDatabase, unexpected sqlite_master object types, and statements
 * failing with a null exception message.
 */
class SqlExecutionServiceFailurePathsTest {

	private final SqlParser sqlParser = new SqlParser();
	private final MetadataExtractor metadataExtractor = new MetadataExtractor();
	private final DatabasePoolManager realPool = createRealPool();

	private static DatabasePoolManager createRealPool() {
		var props = new PoolProperties();
		props.setMaxDatabases(500);
		props.setIdleTimeout(Duration.ofMinutes(30));
		props.setCleanupInterval(Duration.ofMinutes(5));
		return new DatabasePoolManager(props);
	}

	@AfterEach
	void tearDown() {
		realPool.cleanup();
	}

	private SqlExecutionService serviceWithPool(JdbcTemplate jdbc, boolean isNew) {
		var poolManager = mock(DatabasePoolManager.class);
		when(poolManager.getOrCreateJdbcTemplate(anyString(), any()))
				.thenReturn(new PoolEntry(jdbc, isNew));
		return new SqlExecutionService(poolManager, sqlParser, metadataExtractor);
	}

	@Test
	void freshPoolWithoutResetFlagsSessionRecreated() {
		// A real in-memory SQLite JdbcTemplate so clearDatabase + metadata succeed.
		JdbcTemplate jdbc = realPool.getOrCreateJdbcTemplate("session_recreated_db").jdbcTemplate();
		var service = serviceWithPool(jdbc, true);

		SqlResponse response = service.execute("SELECT 1 AS one;", "flag_db", false);

		assertNull(response.getError());
		assertTrue(response.isSessionRecreated(), "isNew pool without explicit reset must flag session recreation");
		assertEquals(1, response.getData().getMetadata().getStatementCount());
	}

	@Test
	void connectionAcquisitionFailureReturnsInternalServerError() {
		JdbcTemplate jdbc = mock(JdbcTemplate.class);
		when(jdbc.execute(any(ConnectionCallback.class))).thenThrow(new RuntimeException("sqlite exploded"));
		var service = serviceWithPool(jdbc, true);

		SqlResponse response = service.execute("SELECT 1;", "clear_fail_db", false);

		assertNotNull(response.getError());
		assertEquals("Internal server error", response.getError().getMessage());
		assertTrue(response.isSessionRecreated());
	}

	@Test
	void transactionCleanupFailureDiscardsTheConnection() throws Exception {
		JdbcTemplate jdbc = mock(JdbcTemplate.class);
		HikariDataSource dataSource = mock(HikariDataSource.class);
		when(jdbc.getDataSource()).thenReturn(dataSource);
		Connection connection = mock(Connection.class);
		when(connection.createStatement()).thenThrow(new SQLException("connection broken"));
		when(jdbc.execute(any(ConnectionCallback.class))).thenAnswer(inv ->
				((ConnectionCallback<?>) inv.getArgument(0)).doInConnection(connection));
		var manager = mock(DatabasePoolManager.class);
		when(manager.getOrCreateJdbcTemplate(anyString(), any())).thenReturn(new PoolEntry(jdbc, false));
		var service = new SqlExecutionService(manager, sqlParser, mock(MetadataExtractor.class));
		var result = service.execute("", "broken_tx", false);
		assertNotNull(result.getError());
		assertEquals("Failed to clean up SQL transaction", result.getError().getMessage());
		verify(dataSource).evictConnection(connection);
		verify(manager).release("broken_tx");
	}

	@Test
	void transactionCleanupFailureWithoutPoolEvictionStillReleasesTheSession() throws Exception {
		for (String message : new String[]{null, "rollback rejected"}) {
			JdbcTemplate jdbc = mock(JdbcTemplate.class);
			Connection connection = mock(Connection.class);
			Statement statement = mock(Statement.class);
			when(connection.createStatement()).thenReturn(statement);
			when(statement.execute("ROLLBACK")).thenThrow(new SQLException(message));
			when(jdbc.execute(any(ConnectionCallback.class))).thenAnswer(inv ->
					((ConnectionCallback<?>) inv.getArgument(0)).doInConnection(connection));
			var manager = mock(DatabasePoolManager.class);
			when(manager.getOrCreateJdbcTemplate(anyString(), any())).thenReturn(new PoolEntry(jdbc, false));
			var service = new SqlExecutionService(manager, sqlParser, mock(MetadataExtractor.class));

			var result = service.execute("", "broken_tx_without_pool", false);

			assertNotNull(result.getError());
			assertEquals("Failed to clean up SQL transaction", result.getError().getMessage());
			assertFalse(result.isSessionRecreated());
			verify(manager).release("broken_tx_without_pool");
		}
	}

	@Test
	void unexpectedSchemaObjectTypeInClearDatabaseReturnsInternalServerError() throws Exception {
		JdbcTemplate jdbc = mock(JdbcTemplate.class);
		when(jdbc.queryForList(anyString())).thenReturn(List.of(
				Map.of("name", "weird_object", "type", "weird")));
		Connection connection = mock(Connection.class);
		Statement stmt = mock(Statement.class);
		when(connection.createStatement()).thenReturn(stmt);
		when(stmt.execute(anyString())).thenReturn(true);
		when(jdbc.execute(any(ConnectionCallback.class))).thenAnswer(inv ->
				((ConnectionCallback<?>) inv.getArgument(0)).doInConnection(connection));

		var service = serviceWithPool(jdbc, true);
		SqlResponse response = service.execute("SELECT 1;", "weird_type_db", false);

		assertNotNull(response.getError());
		assertEquals("Internal server error", response.getError().getMessage());
	}

	@Test
	void statementFailureWithNullMessageFallsBackToUnknownError() {
		JdbcTemplate jdbc = mock(JdbcTemplate.class);
		when(jdbc.execute(any(StatementCallback.class)))
				.thenThrow(new RuntimeException((String) null));
		var service = serviceWithPool(jdbc, false);

		SqlResponse response = ReflectionTestUtils.invokeMethod(service, "runScript", "SELECT 1;", jdbc, new SqlResponse());

		assertNotNull(response.getError());
		assertEquals("unknown error", response.getError().getMessage());
	}
}
