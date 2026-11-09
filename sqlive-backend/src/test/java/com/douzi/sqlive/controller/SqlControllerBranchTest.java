package com.douzi.sqlive.controller;

import com.douzi.sqlive.dto.SqlRequest;
import com.douzi.sqlive.dto.SqlResponse;
import com.douzi.sqlive.service.SqlExecutionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Direct unit tests for {@link SqlController} guard/log branches that HTTP-level
 * tests cannot reach: blank SQL (blocked earlier by @Valid in the real pipeline),
 * the session-recreated response header, and dbName defaulting.
 */
class SqlControllerBranchTest {

	@Test
	void blankSqlShortCircuitsBeforeTouchingTheService() {
		var sqlService = mock(SqlExecutionService.class);
		var controller = new SqlController(sqlService);

		var request = new SqlRequest();
		request.setSql("   ");
		request.setDbName("db1");

		SqlResponse response = controller.executeSql(request,
				new MockHttpServletRequest(), new MockHttpServletResponse());

		assertNotNull(response.getError());
		assertEquals("SQL cannot be empty", response.getError().getMessage());
		verify(sqlService, never()).execute(anyString(), anyString(), anyBoolean(), anyString());
	}

	@Test
	void nullSqlShortCircuitsBeforeTouchingTheService() {
		var sqlService = mock(SqlExecutionService.class);
		var controller = new SqlController(sqlService);

		var request = new SqlRequest();
		request.setDbName("db1");

		SqlResponse response = controller.executeSql(request,
				new MockHttpServletRequest(), new MockHttpServletResponse());

		assertNotNull(response.getError());
		assertEquals("SQL cannot be empty", response.getError().getMessage());
	}

	@Test
	void sessionRecreatedFlagSetsResponseHeader() {
		var sqlService = mock(SqlExecutionService.class);
		var controller = new SqlController(sqlService);

		var recreated = new SqlResponse();
		recreated.setSessionRecreated(true);
		when(sqlService.execute(anyString(), anyString(), anyBoolean(), anyString()))
				.thenReturn(recreated);

		var request = new SqlRequest();
		request.setSql("SELECT 1;");
		request.setDbName("db1");
		var httpResponse = new MockHttpServletResponse();

		SqlResponse response = controller.executeSql(request, new MockHttpServletRequest(), httpResponse);

		assertEquals("true", httpResponse.getHeader("X-Session-Recreated"));
		assertTrue(response.isSessionRecreated());
	}

	@Test
	void nullDbNameFallsBackToDefaultDatabase() {
		var sqlService = mock(SqlExecutionService.class);
		var controller = new SqlController(sqlService);
		when(sqlService.execute(anyString(), anyString(), anyBoolean(), anyString()))
				.thenReturn(new SqlResponse());

		var request = new SqlRequest();
		request.setSql("SELECT 1;");
		var httpResponse = new MockHttpServletResponse();

		controller.executeSql(request, new MockHttpServletRequest(), httpResponse);

		verify(sqlService).execute(eq("SELECT 1;"), eq("default"), eq(false), anyString());
	}

	@Test
	void emptyDbNameFallsBackToDefaultDatabase() {
		var sqlService = mock(SqlExecutionService.class);
		var controller = new SqlController(sqlService);
		when(sqlService.execute(anyString(), anyString(), anyBoolean(), anyString()))
				.thenReturn(new SqlResponse());

		var request = new SqlRequest();
		request.setSql("SELECT 1;");
		request.setDbName("");
		controller.executeSql(request, new MockHttpServletRequest(), new MockHttpServletResponse());

		verify(sqlService).execute(anyString(), eq("default"), anyBoolean(), anyString());
	}

	@Test
	void successResponseWithPartialDataIsLoggedWithoutThrowing() {
		var sqlService = mock(SqlExecutionService.class);
		var controller = new SqlController(sqlService);
		// data present but tables/metadata null — log line must fall back to 0 counts
		var partial = new SqlResponse();
		partial.setData(new SqlResponse.DataPayload());
		when(sqlService.execute(anyString(), anyString(), anyBoolean(), anyString()))
				.thenReturn(partial);

		var request = new SqlRequest();
		request.setSql("SELECT 1;");
		request.setDbName("db1");

		SqlResponse response = controller.executeSql(request,
				new MockHttpServletRequest(), new MockHttpServletResponse());
		assertNotNull(response.getData());
	}

	@Test
	void errorResponseIsLoggedWithoutThrowing() {
		var sqlService = mock(SqlExecutionService.class);
		var controller = new SqlController(sqlService);
		when(sqlService.execute(anyString(), anyString(), anyBoolean(), anyString()))
				.thenReturn(SqlResponse.error("boom", 3));

		var request = new SqlRequest();
		request.setSql("SELECT bad;");
		request.setDbName("db1");

		SqlResponse response = controller.executeSql(request,
				new MockHttpServletRequest(), new MockHttpServletResponse());

		assertEquals("boom", response.getError().getMessage());
	}
}
