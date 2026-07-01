package com.douzi.sqlive.exception;

import com.douzi.sqlive.dto.SqlResponse;
import com.douzi.sqlive.dto.ai.AiChatResponse;
import com.douzi.sqlive.service.database.TooManyDatabasesException;
import jakarta.annotation.Nullable;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

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

	@ExceptionHandler(Exception.class)
	@ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
	public SqlResponse handleGeneral(Exception e) {
		log.error("Unhandled exception", e);
		return SqlResponse.error("Internal server error", 0);
	}
}
