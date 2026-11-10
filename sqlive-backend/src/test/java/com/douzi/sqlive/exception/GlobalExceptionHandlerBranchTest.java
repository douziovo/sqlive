package com.douzi.sqlive.exception;

import com.douzi.sqlive.dto.SqlResponse;
import com.douzi.sqlive.service.database.TooManyDatabasesException;
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Branch coverage for {@link GlobalExceptionHandler}: the TooManyDatabases
 * payload, validation with no field errors, SPA forward failures, and the
 * default 404 ProblemDetail fall-through with null headers/status.
 */
class GlobalExceptionHandlerBranchTest {

	private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

	@Test
	void tooManyDatabasesReturnsErrorPayloadWithLimitMessage() {
		var ex = new TooManyDatabasesException("服务器繁忙，请稍后重试 (limit: 2000)");
		SqlResponse response = handler.handleTooManyDatabases(ex);
		assertNotNull(response.getError());
		assertTrue(response.getError().getMessage().contains("limit"));
	}

	@Test
	void validationWithoutFieldErrorsFallsBackToGenericMessage() {
		BindingResult bindingResult = mock(BindingResult.class);
		when(bindingResult.getFieldErrors()).thenReturn(List.of());

		MethodArgumentNotValidException ex = mock(MethodArgumentNotValidException.class);
		when(ex.getBindingResult()).thenReturn(bindingResult);

		ResponseEntity<Object> result = handler.handleMethodArgumentNotValid(ex, null, null, null);

		assertEquals(400, result.getStatusCode().value());
		var body = assertInstanceOf(SqlResponse.class, result.getBody());
		assertEquals("Validation failed", body.getError().getMessage());
	}

	@Test
	void spaForwardFailureFallsBackToDefault404Response() throws ServletException, IOException {
		var ex = new NoResourceFoundException(HttpMethod.GET, "/docs/usage", "docs/usage");

		RequestDispatcher dispatcher = mock(RequestDispatcher.class);
		doThrow(new ServletException("forward exploded")).when(dispatcher).forward(any(), any());

		HttpServletRequest request = mock(HttpServletRequest.class);
		HttpServletResponse response = mock(HttpServletResponse.class);
		when(request.getHeader("Accept")).thenReturn("text/html,application/xhtml+xml");
		when(request.getRequestURI()).thenReturn("/docs/usage");
		when(request.getRequestDispatcher("/index.html")).thenReturn(dispatcher);

		var webRequest = new ServletWebRequest(request, response);
		ResponseEntity<Object> result = handler.handleNoResourceFoundException(ex, null, null, webRequest);

		assertNotNull(result);
		assertEquals(404, result.getStatusCode().value());
	}

	@Test
	void nonHtmlAcceptSkipsSpaForwardAndReturnsDefault404() {
		var ex = new NoResourceFoundException(HttpMethod.GET, "/api/nope", "api/nope");

		MockServletRequestWithoutHtml request = new MockServletRequestWithoutHtml();
		var webRequest = new ServletWebRequest(request, new org.springframework.mock.web.MockHttpServletResponse());

		ResponseEntity<Object> result = handler.handleNoResourceFoundException(
				ex, null, null, webRequest);

		assertNotNull(result);
		assertEquals(404, result.getStatusCode().value());
		assertNull(request.forwardedTo, "SPA forward must not happen for non-HTML requests");
	}

	@Test
	void apiPathNeverForwardsEvenForHtmlAccept() {
		var ex = new NoResourceFoundException(HttpMethod.GET, "/api/unknown", "api/unknown");

		HttpServletRequest request = mock(HttpServletRequest.class);
		HttpServletResponse response = mock(HttpServletResponse.class);
		when(request.getHeader("Accept")).thenReturn("text/html");
		when(request.getRequestURI()).thenReturn("/api/unknown");
		when(request.getRequestDispatcher(anyString())).thenThrow(AssertionError.class);

		var webRequest = new ServletWebRequest(request, response);
		ResponseEntity<Object> result = handler.handleNoResourceFoundException(
				ex, new HttpHeaders(), HttpStatus.NOT_FOUND, webRequest);

		assertEquals(404, result.getStatusCode().value());
	}

	@Test
	void validationWithMultipleFieldErrorsJoinsMessages() {
		BindingResult bindingResult = mock(BindingResult.class);
		when(bindingResult.getFieldErrors()).thenReturn(List.of(
				new org.springframework.validation.FieldError("sqlRequest", "sql", "SQL cannot be empty"),
				new org.springframework.validation.FieldError("sqlRequest", "dbName", "dbName is invalid")));

		MethodArgumentNotValidException ex = mock(MethodArgumentNotValidException.class);
		when(ex.getBindingResult()).thenReturn(bindingResult);

		ResponseEntity<Object> result = handler.handleMethodArgumentNotValid(ex, null, null, null);
		var body = assertInstanceOf(SqlResponse.class, result.getBody());
		assertEquals("sql: SQL cannot be empty; dbName: dbName is invalid", body.getError().getMessage());
	}

	@Test
	void nonServletWebRequestSkipsSpaLogicEntirely() {
		var ex = new NoResourceFoundException(HttpMethod.GET, "/anything", "anything");
		var plainRequest = mock(org.springframework.web.context.request.WebRequest.class);

		ResponseEntity<Object> result = handler.handleNoResourceFoundException(
				ex, new HttpHeaders(), HttpStatus.NOT_FOUND, plainRequest);
		assertEquals(404, result.getStatusCode().value());
	}

	@Test
	void servletWebRequestWithoutResponseSkipsSpaLogic() {
		var ex = new NoResourceFoundException(HttpMethod.GET, "/docs/x", "docs/x");
		// ServletWebRequest(request) leaves response null
		var webRequest = new ServletWebRequest(new org.springframework.mock.web.MockHttpServletRequest());

		ResponseEntity<Object> result = handler.handleNoResourceFoundException(
				ex, new HttpHeaders(), HttpStatus.NOT_FOUND, webRequest);
		assertEquals(404, result.getStatusCode().value());
	}

	@Test
	void whitelistedPrefixesNeverForwardEvenWithHtmlAccept() {
		for (String path : new String[]{"/v3/api-docs/x", "/swagger-ui/x", "/static/x", "/error"}) {
			var ex = new NoResourceFoundException(HttpMethod.GET, path, path.substring(1));

			HttpServletRequest request = mock(HttpServletRequest.class);
			HttpServletResponse response = mock(HttpServletResponse.class);
			when(request.getHeader("Accept")).thenReturn("text/html");
			when(request.getRequestURI()).thenReturn(path);
			when(request.getRequestDispatcher(anyString()))
					.thenThrow(AssertionError.class);

			var webRequest = new ServletWebRequest(request, response);
			ResponseEntity<Object> result = handler.handleNoResourceFoundException(
					ex, new HttpHeaders(), HttpStatus.NOT_FOUND, webRequest);
			assertEquals(404, result.getStatusCode().value(), "no SPA forward for " + path);
		}
	}

	@Test
	void nullAcceptHeaderOnSpaPathSkipsForward() {
		var ex = new NoResourceFoundException(HttpMethod.GET, "/docs/usage", "docs/usage");

		HttpServletRequest request = mock(HttpServletRequest.class);
		HttpServletResponse response = mock(HttpServletResponse.class);
		when(request.getHeader("Accept")).thenReturn(null);
		when(request.getRequestURI()).thenReturn("/docs/usage");
		when(request.getRequestDispatcher(anyString())).thenThrow(AssertionError.class);

		var webRequest = new ServletWebRequest(request, response);
		ResponseEntity<Object> result = handler.handleNoResourceFoundException(
				ex, new HttpHeaders(), HttpStatus.NOT_FOUND, webRequest);
		assertEquals(404, result.getStatusCode().value());
	}

	/** Minimal HttpServletRequest stub: no Accept header, records forwards. */
	private static final class MockServletRequestWithoutHtml
			extends org.springframework.mock.web.MockHttpServletRequest {
		String forwardedTo;

		@Override
		public String getHeader(String name) {
			return "Accept".equalsIgnoreCase(name) ? "application/json" : null;
		}

		@Override
		public RequestDispatcher getRequestDispatcher(String path) {
			forwardedTo = path;
			return null;
		}
	}
}
