package com.douzi.sqlive.service;

import com.douzi.sqlive.dto.ExecutionMetadata;
import com.douzi.sqlive.dto.ForeignKeyInfo;
import com.douzi.sqlive.dto.SqlResponse;
import com.douzi.sqlive.dto.TableSchema;
import com.douzi.sqlive.service.database.DatabasePoolManager;
import com.douzi.sqlive.service.metadata.MetadataExtractor;
import com.douzi.sqlive.service.sql.SqlParser;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@Service
@Slf4j
public class SqlExecutionService {

	private static final Pattern SQL_COMMENT = Pattern.compile("(?:/\\*[\\s\\S]*?\\*/|--[^\r\n]*)");
	static final String DEFAULT_ATTACH_PATTERN = "(?i)\\bATTACH\\s+(?:DATABASE\\b|')";
	static final String DEFAULT_PRAGMA_PATTERN = "(?i)^\\s*PRAGMA\\b";
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

	@SuppressWarnings("SqlSourceToSinkFlow")
	public SqlResponse execute(String sqlScript, String dbName, boolean reset) {
		return execute(sqlScript, dbName, reset, null);
	}

	@SuppressWarnings("SqlSourceToSinkFlow")
	public SqlResponse execute(String sqlScript, String dbName, boolean reset, @org.springframework.lang.Nullable String clientIp) {
		SqlResponse response = new SqlResponse();
		var poolEntry = poolManager.getOrCreateJdbcTemplate(dbName, clientIp);
		JdbcTemplate jdbc = poolEntry.jdbcTemplate();

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

	private String isBlockedStatement(String sql) {
		String cleaned = SQL_COMMENT.matcher(sql).replaceAll("");
		if (attachPattern.matcher(cleaned).find()) {
			return attachError;
		}
		if (pragmaPattern.matcher(cleaned).find()) {
			return pragmaError;
		}
		return null;
	}

	private void clearDatabase(JdbcTemplate jdbc) {
		var allObjects = jdbc.queryForList(
				"SELECT name, type FROM sqlite_master WHERE type IN ('view','trigger','table') AND name NOT LIKE 'sqlite_%'");

		// D-06: use MetadataExtractor.extractForeignKeys to get FK graph data.
		List<ForeignKeyInfo> fks = metadataExtractor.extractForeignKeys(jdbc);

		// D-07: topological sort — referencing (leaf) tables dropped first, referenced (parent) tables last.
		List<String> tableNames = new ArrayList<>();
		for (var obj : allObjects) {
			if ("table".equals(obj.get("type"))) {
				tableNames.add((String) obj.get("name"));
			}
		}
		List<String> dropOrder = topologicalSortTables(tableNames, fks);

		jdbc.execute((Connection con) -> {
			try (Statement stmt = con.createStatement()) {
				// Drop VIEW and TRIGGER objects first (independent of FK graph — no FK constraints).
				for (var obj : allObjects) {
					String type = (String) obj.get("type");
					if (type == null) continue;
					String name = stmt.enquoteIdentifier((String) obj.get("name"), false);
					switch (type) {
						case "view" -> stmt.execute("DROP VIEW IF EXISTS " + name);
						case "trigger" -> stmt.execute("DROP TRIGGER IF EXISTS " + name);
						default -> { /* tables dropped below in topological order */ }
					}
				}
				// D-08: no FK enforcement toggle — topological order makes DROP safe without disabling enforcement.
				for (String tableName : dropOrder) {
					String name = stmt.enquoteIdentifier(tableName, false);
					stmt.execute("DROP TABLE IF EXISTS " + name);
				}
			}
			return null;
		});
	}

	/**
	 * D-07: Kahn's BFS topological sort for FK-safe DROP order.
	 * <p>
	 * CRITICAL: see 12-PATTERNS.md "Critical Warning" — RESEARCH.md Example 6 has reversed adjacency direction.
	 * Correct semantics: {@code fromTable} = referencing/child, {@code toTable} = referenced/parent
	 * (ForeignKeyInfo.java:8,11 + MetadataExtractor.java:199-201).
	 * <p>
	 * Referencing/leaf tables (inDegree 0 = no one references me) are dropped FIRST;
	 * referenced/parent tables (inDegree > 0) are dropped LAST — no child references a dropped parent.
	 * <p>
	 * Cycle fallback (D-07): if FK cycle exists, appends unvisited tables in arbitrary order + log.warn.
	 * Package-private for synthetic test access from same-package test class.
	 */
	List<String> topologicalSortTables(List<String> tables, List<ForeignKeyInfo> fks) {
		// Adjacency: referencing → [referenced] (fromTable → [toTable])
		Map<String, List<String>> referencingToReferenced = new HashMap<>();
		for (ForeignKeyInfo fk : fks) {
			referencingToReferenced.computeIfAbsent(fk.getFromTable(), k -> new ArrayList<>()).add(fk.getToTable());
		}

		// inDegree = number of FKs pointing TO this table (referenced/parent tables have inDegree > 0)
		Map<String, Integer> inDegree = new HashMap<>();
		for (String t : tables) inDegree.put(t, 0);
		for (ForeignKeyInfo fk : fks) {
			if (inDegree.containsKey(fk.getToTable())) inDegree.merge(fk.getToTable(), 1, Integer::sum);
		}

		// Kahn's BFS — start with referencing/leaf tables (inDegree 0 = no one references me)
		Deque<String> queue = new ArrayDeque<>();
		for (Map.Entry<String, Integer> e : inDegree.entrySet()) {
			if (e.getValue() == 0) queue.add(e.getKey());
		}

		List<String> result = new ArrayList<>();
		while (!queue.isEmpty()) {
			String t = queue.poll();  // referencing/leaf table — safe to drop first
			result.add(t);
			// Decrement inDegree of tables this one references (removing the edge)
			List<String> referenced = referencingToReferenced.get(t);
			if (referenced != null) {
				for (String ref : referenced) {
					if (inDegree.containsKey(ref) && inDegree.merge(ref, -1, Integer::sum) == 0) {
						queue.add(ref);
					}
				}
			}
		}

		// Cycle fallback — D-07: "降级为随机顺序 + log.warn"
		if (result.size() < tables.size()) {
			List<String> unvisited = tables.stream().filter(t -> !result.contains(t)).toList();
			log.warn("FK cycle detected, dropping in arbitrary order: {}", unvisited);
			result.addAll(unvisited);
		}
		return result;
	}
}
