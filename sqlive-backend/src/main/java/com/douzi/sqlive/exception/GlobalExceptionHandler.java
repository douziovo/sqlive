package com.douzi.sqlive.exception;

import com.douzi.sqlive.dto.SqlResponse;
import com.douzi.sqlive.dto.ai.AiChatResponse;
import com.douzi.sqlive.service.database.TooManyDatabasesException;
import jakarta.annotation.Nullable;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.io.IOException;

@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

	@ExceptionHandler(TooManyDatabasesException.class)
	@ResponseStatus(HttpStatus.TOO_MANY_REQUESTS)
	public SqlResponse handleTooManyDatabases(TooManyDatabasesException e) {
		log.warn("Too many databases: {}", e.getMessage());
		return SqlResponse.error(e.getMessage(), 0);
	}

	@ExceptionHandler(AiProviderException.class)
	@ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
	public AiChatResponse handleAiProvider(AiProviderException e) {
		log.warn("AI provider failed: {}", e.getMessage());
		return AiChatResponse.error(e.getMessage());
	}

	@Override
	protected ResponseEntity<Object> handleMethodArgumentNotValid(
			MethodArgumentNotValidException ex,
			@Nullable HttpHeaders headers,
			@Nullable HttpStatusCode status,
			@Nullable WebRequest request) {
		String message = ex.getBindingResult().getFieldErrors().stream()
				.map(f -> f.getField() + ": " + f.getDefaultMessage())
				.reduce((a, b) -> a + "; " + b)
				.orElse("Validation failed");
		log.warn("Validation failed: {}", message);
		return new ResponseEntity<>(SqlResponse.error(message, 0), HttpStatus.BAD_REQUEST);
	}

	/**
	 * SPA fallback for vue-router deep-link refresh (D-10).
	 *
	 * <p>Spring Boot 4 raises {@link NoResourceFoundException} when no static
	 * resource matches the request path. The default handler returns a 404
	 * ProblemDetail JSON. For browser refreshes of SPA routes like
	 * {@code /docs/usage/editor}, we instead forward to {@code /index.html}
	 * so the frontend router can resolve the URL client-side.
	 *
	 * <p>Whitelist (Pitfall 5): forward only when {@code Accept} contains
	 * {@code text/html} AND the path is not under {@code /api/**},
	 * {@code /v3/api-docs}, {@code /swagger-ui}, {@code /static/}, or
	 * {@code /error}. API paths must return JSON 404 (not HTML) so frontend
	 * fetch/axios can parse error bodies; springdoc's {@code /v3/api-docs}
	 * must serve JSON directly.
	 *
	 * <p>Overrides {@link ResponseEntityExceptionHandler#handleNoResourceFoundException}
	 * rather than registering a new {@code @ExceptionHandler} — adding a new
	 * {@code @ExceptionHandler(NoResourceFoundException.class)} method would
	 * conflict with the inherited {@code @ExceptionHandler} declaration on
	 * {@code ResponseEntityExceptionHandler.handleException} (same exception
	 * type + MediaType.ALL key) and throw {@link IllegalStateException} at
	 * startup.
	 */
	@Override
	protected @Nullable ResponseEntity<Object> handleNoResourceFoundException(
			NoResourceFoundException ex,
			@Nullable HttpHeaders headers,
			@Nullable HttpStatusCode status,
			WebRequest webRequest) {
		if (webRequest instanceof ServletWebRequest servletWebRequest) {
			HttpServletRequest request = servletWebRequest.getRequest();
			HttpServletResponse response = servletWebRequest.getResponse();
			if (request != null && response != null) {
				String accept = request.getHeader("Accept");
				String path = request.getRequestURI();
				boolean isHtmlRequest = accept != null && accept.contains("text/html");
				boolean isSpaPath = !path.startsWith("/api/")
						&& !path.startsWith("/v3/api-docs")
						&& !path.startsWith("/swagger-ui")
						&& !path.startsWith("/static/")
						&& !path.equals("/error");
				if (isHtmlRequest && isSpaPath) {
					try {
						request.getRequestDispatcher("/index.html").forward(request, response);
						return null;
					} catch (ServletException | IOException e) {
						log.warn("SPA fallback forward failed for {}: {}", path, e.getMessage());
					}
				}
			}
		}
		// Non-SPA paths fall through to the default 404 ProblemDetail JSON response.
		return super.handleNoResourceFoundException(ex, headers, status, webRequest);
	}

	@ExceptionHandler(Exception.class)
	@ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
	public SqlResponse handleGeneral(Exception e) {
		log.error("Unhandled exception", e);
		return SqlResponse.error("Internal server error", 0);
	}
}
