package com.douzi.sqlive.service;

import com.douzi.sqlive.dto.ExecutionMetadata;
import com.douzi.sqlive.dto.SqlResponse;
import com.douzi.sqlive.dto.TableSchema;
import com.douzi.sqlive.service.database.DatabasePoolManager;
import com.douzi.sqlive.service.metadata.MetadataExtractor;
import com.douzi.sqlive.service.sql.SqlParser;
import jakarta.annotation.Nullable;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@SuppressWarnings("SqlNoDataSourceInspection")
@Service
@Slf4j
public class SqlExecutionService {

	private static final Pattern SQL_COMMENT = Pattern.compile("/\\*[\\s\\S]*?\\*/|--[^\r\n]*");
	static final String DEFAULT_ATTACH_PATTERN = "(?i)^[\\s\\uFEFF]*(?:EXPLAIN(?:\\s+QUERY\\s+PLAN)?\\s+)?ATTACH\\b";
	static final String DEFAULT_PRAGMA_PATTERN = "(?i)^[\\s\\uFEFF]*(?:EXPLAIN(?:\\s+QUERY\\s+PLAN)?\\s+)?PRAGMA\\b";
	private static final Pattern FILE_OPERATION_PATTERN = Pattern.compile("(?i)^[\\s\\uFEFF]*(?:EXPLAIN(?:\\s+QUERY\\s+PLAN)?\\s+)?(?:VACUUM|BACKUP|RESTORE)\\b");
	static final String DEFAULT_ATTACH_ERROR = "ATTACH DATABASE is not allowed for security reasons";
	static final String DEFAULT_PRAGMA_ERROR = "PRAGMA statements are not allowed";
	@Value("${SQLIVE_ATTACH_PATTERN:" + DEFAULT_ATTACH_PATTERN + "}")
	private String attachPatternStr;
	@Value("${SQLIVE_PRAGMA_PATTERN:" + DEFAULT_PRAGMA_PATTERN + "}")
	private String pragmaPatternStr;
	@Value("${SQLIVE_ATTACH_ERROR:" + DEFAULT_ATTACH_ERROR + "}")
	private String attachError;
	@Value("${SQLIVE_PRAGMA_ERROR:" + DEFAULT_PRAGMA_ERROR + "}")
	private String pragmaError;
	private Pattern attachPattern;
	private Pattern pragmaPattern;
	private final DatabasePoolManager poolManager;
	private final SqlParser sqlParser;
	private final MetadataExtractor metadataExtractor;

	public SqlExecutionService(DatabasePoolManager poolManager, SqlParser sqlParser,
	                           MetadataExtractor metadataExtractor) {
		this.poolManager = poolManager;
		this.sqlParser = sqlParser;
		this.metadataExtractor = metadataExtractor;
		initPatterns();
	}

	@PostConstruct
	void initPatterns() {
		attachPattern = Pattern.compile(attachPatternStr != null ? attachPatternStr : DEFAULT_ATTACH_PATTERN);
		pragmaPattern = Pattern.compile(pragmaPatternStr != null ? pragmaPatternStr : DEFAULT_PRAGMA_PATTERN);
		if (attachError == null) attachError = DEFAULT_ATTACH_ERROR;
		if (pragmaError == null) pragmaError = DEFAULT_PRAGMA_ERROR;
	}

	public SqlResponse execute(String sqlScript, String dbName, boolean reset) {
		return execute(sqlScript, dbName, reset, null);
	}

	public SqlResponse execute(String sqlScript, String dbName, boolean reset, @Nullable String clientIp) {
		SqlResponse response = new SqlResponse();
		var poolEntry = poolManager.getOrCreateJdbcTemplate(dbName, clientIp);
		JdbcTemplate jdbc = poolEntry.jdbcTemplate();

		// Serialize whole scripts, including reset and metadata, within one database.
		synchronized (jdbc) {
			// If the database was just recreated after eviction and the client didn't
			// request a reset, flag session recreation so the frontend can show a recovery toast.
			if (poolEntry.isNew() && !reset) {
				response.setSessionRecreated(true);
			}

			try {
				if (reset || poolEntry.isNew()) {
					clearDatabase(jdbc);
				}
				List<SqlParser.SqlStatement> statements = sqlParser.parseStatementsPrecise(sqlScript);
				List<TableSchema> allQueryResults = new ArrayList<>();
				int statementCount = 0;
				long startTime = System.nanoTime();

				for (SqlParser.SqlStatement s : statements) {
					if (s.sql().trim().isEmpty()) continue;

					String blockedReason = isBlockedStatement(s.sql());
					if (blockedReason != null) {
						return SqlResponse.error(blockedReason, s.startLine());
					}

					try {
						jdbc.execute((Statement stmt) -> {
							// D-R0-004 / WARN-01: @SuppressWarnings narrowed from method-level to the actual SQL sink
							// (local variable declaration — Java annotations can only target declarations, not statements).
							@SuppressWarnings("SqlSourceToSinkFlow")
							boolean hasResultSet = stmt.execute(s.sql());
							if (hasResultSet) {
								try (ResultSet rs = stmt.getResultSet()) {
									String resultName = allQueryResults.isEmpty()
											? "查询结果"
											: "查询结果 " + (allQueryResults.size() + 1);
									allQueryResults.add(metadataExtractor.extractTableSchema(rs, resultName));
								}
							}
							return null;
						});
						statementCount++;
					} catch (Exception e) {
						log.warn("SQL execution failed at line {}: {}", s.startLine(), e.getMessage());
						String rawMsg = e.getMessage() != null ? e.getMessage() : "unknown error";
						String cleanMsg = rawMsg.replace("[SQLITE_ERROR] SQL error or missing database ", "");
						return SqlResponse.error(cleanMsg,
								sqlParser.locateErrorLine(s.sql(), s.startLine(), rawMsg));
					}
				}

				long durationMs = (System.nanoTime() - startTime) / 1_000_000;

				SqlResponse.DataPayload payload = new SqlResponse.DataPayload();
				payload.setTables(metadataExtractor.extractAllTables(jdbc));
				payload.setQueryResults(allQueryResults);
				payload.setIndexes(metadataExtractor.extractIndexes(jdbc));
				payload.setViews(metadataExtractor.extractViews(jdbc));
				payload.setTriggers(metadataExtractor.extractTriggers(jdbc));
				payload.setForeignKeys(metadataExtractor.extractForeignKeys(jdbc));

				// D-03b: populate canonicalStatements with 1:1 mapping from parsed statements.
				// Char offsets match JS String.prototype.substring per Phase 2 D-01 (UTF-16 code unit indices).
				List<SqlResponse.CanonicalStatement> canonical = statements.stream()
						.map(s -> {
							SqlResponse.CanonicalStatement cs = new SqlResponse.CanonicalStatement();
							cs.setStart(s.startPos());
							cs.setEnd(s.endPos());
							return cs;
						})
						.toList();
				payload.setCanonicalStatements(canonical);

				ExecutionMetadata meta = new ExecutionMetadata();
				meta.setDurationMs(durationMs);
				meta.setStatementCount(statementCount);
				payload.setMetadata(meta);

				response.setSuccess(true);
				response.setData(payload);

			} catch (Exception e) {
				log.error("Failed to execute SQL script", e);
				return SqlResponse.error("Internal server error", 0);
			} finally {
				poolManager.release(dbName);
			}

			return response;
		}
	}

	private String isBlockedStatement(String sql) {
		String cleaned = SQL_COMMENT.matcher(sql).replaceAll(" ");
		if (attachPattern.matcher(cleaned).find()) {
			return attachError;
		}
		if (FILE_OPERATION_PATTERN.matcher(cleaned).find()) {
			return "File operations (VACUUM, BACKUP, RESTORE) are not allowed";
		}
		if (pragmaPattern.matcher(cleaned).find()) {
			return pragmaError;
		}
		return null;
	}

	private void clearDatabase(JdbcTemplate jdbc) {
		var objects = jdbc.queryForList(
				"SELECT name, type FROM sqlite_master WHERE type IN ('view','trigger','table') AND name NOT LIKE 'sqlite_%'");
		jdbc.execute((Connection con) -> {
			try (Statement stmt = con.createStatement()) {
				// A complete reset must also handle populated FK cycles. Only trusted reset code
				// disables enforcement, on this connection, and restores it before user SQL runs.
				stmt.execute("PRAGMA foreign_keys = OFF");
				try {
					for (var obj : objects) {
						String type = switch (String.valueOf(obj.get("type"))) {
							case "view" -> "VIEW";
							case "trigger" -> "TRIGGER";
							case "table" -> "TABLE";
							default -> throw new IllegalStateException("Unexpected schema object");
						};
						stmt.execute("DROP " + type + " IF EXISTS " + MetadataExtractor.quoteIdentifier((String) obj.get("name")));
					}
				} finally {
					stmt.execute("PRAGMA foreign_keys = ON");
				}
			}
			return null;
		});
	}
}
