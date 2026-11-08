package com.douzi.sqlive.service;

import com.douzi.sqlive.config.PoolProperties;
import com.douzi.sqlive.service.database.DatabasePoolManager;
import com.douzi.sqlive.service.metadata.MetadataExtractor;
import com.douzi.sqlive.service.sql.SqlParser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

/**
 * Shared fixture for the SqlExecutionService test suite (split by topic from the
 * original single 1286-line class). Provides:
 * <ul>
 *   <li>an isolated {@link DatabasePoolManager} + {@link SqlExecutionService} per test instance</li>
 *   <li>a unique db-name suffix per test ({@link #db(String)}), so tests never collide</li>
 *   <li>the shared {@code test-multi-table.sql} script as {@link #fullScript}</li>
 * </ul>
 */
abstract class SqlExecutionServiceTestSupport {

	protected static String fullScript;
	protected final DatabasePoolManager poolManager = createPoolManager();
	protected final SqlExecutionService service = new SqlExecutionService(
			poolManager, new SqlParser(), new MetadataExtractor());
	protected String dbSuffix;

	@AfterEach
	void cleanupPools() { poolManager.cleanup(); }

	private static DatabasePoolManager createPoolManager() {
		var props = new PoolProperties();
		props.setMaxDatabases(500);
		props.setIdleTimeout(Duration.ofMinutes(30));
		props.setCleanupInterval(Duration.ofMinutes(5));
		return new DatabasePoolManager(props);
	}

	@BeforeAll
	static void loadScript() throws IOException {
		try (InputStream is = SqlExecutionServiceTestSupport.class.getClassLoader()
				.getResourceAsStream("test-multi-table.sql")) {
			if (is == null) {
				throw new IOException("test-multi-table.sql not found on classpath");
			}
			fullScript = new String(is.readAllBytes(), StandardCharsets.UTF_8);
		}
	}

	@BeforeEach
	void generateDbSuffix() {
		dbSuffix = UUID.randomUUID().toString().substring(0, 8);
	}

	protected String db(String prefix) {
		return prefix + "_" + dbSuffix;
	}
}
