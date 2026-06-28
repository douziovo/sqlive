package com.douzi.sqlive.controller;

import com.douzi.sqlive.dto.SqlRequest;
import com.douzi.sqlive.dto.SqlResponse;
import com.douzi.sqlive.service.SqlExecutionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Slf4j
public class SqlController {

	private final SqlExecutionService sqlService;

	public SqlController(SqlExecutionService sqlService) {
		this.sqlService = sqlService;
	}

	@PostMapping("/execute")
	public SqlResponse executeSql(@Valid @RequestBody SqlRequest request,
	                              HttpServletRequest httpRequest,
	                              HttpServletResponse httpResponse) {
		if (request.getSql() == null || request.getSql().trim().isEmpty()) {
			return SqlResponse.error("SQL cannot be empty", 0);
		}

		String dbName = request.getDbName() != null && !request.getDbName().isEmpty()
				? request.getDbName() : "default";

		log.info("Execute request: db={}, reset={}, sqlLength={}", dbName, request.isReset(), request.getSql().length());
		long start = System.currentTimeMillis();

		String clientIp = httpRequest.getRemoteAddr();
		SqlResponse response = sqlService.execute(request.getSql(), dbName, request.isReset(), clientIp);

		if (response.isSessionRecreated()) {
			httpResponse.setHeader("X-Session-Recreated", "true");
		}

		long elapsed = System.currentTimeMillis() - start;
		if (response.isSuccess()) {
			var data = response.getData();
			int tableCount = data != null && data.getTables() != null ? data.getTables().size() : 0;
			int stmtCount = data != null && data.getMetadata() != null ? data.getMetadata().getStatementCount() : 0;
			log.info("Execute success: db={}, tables={}, statements={}, elapsed={}ms", dbName, tableCount, stmtCount, elapsed);
		} else {
			var err = response.getError();
			String errMsg = err != null ? err.getMessage() : "unknown";
			int line = err != null ? err.getLine() : 0;
			log.warn("Execute failed: db={}, line={}, error={}, elapsed={}ms", dbName, line, errMsg, elapsed);
		}

		return response;
	}
}
