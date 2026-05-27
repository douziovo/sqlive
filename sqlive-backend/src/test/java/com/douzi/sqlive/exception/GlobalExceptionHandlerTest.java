package com.douzi.sqlive.exception;

import com.douzi.sqlive.dto.SqlResponse;
import com.douzi.sqlive.dto.ai.AiChatResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void shouldHandleAiProviderException() {
        var ex = new AiProviderException("Ollama 调用失败: connection refused");
        AiChatResponse response = handler.handleAiProvider(ex);

        assertFalse(response.isSuccess());
        assertEquals("Ollama 调用失败: connection refused", response.getError().getMessage());
    }

    @Test
    void shouldHandleAiProviderExceptionWithCause() {
        var cause = new RuntimeException("network timeout");
        var ex = new AiProviderException("AI 服务调用失败: timeout", cause);
        AiChatResponse response = handler.handleAiProvider(ex);

        assertFalse(response.isSuccess());
        assertTrue(response.getError().getMessage().contains("timeout"));
    }

    @Test
    void shouldHandleMethodArgumentNotValid() {
        BindingResult bindingResult = mock(BindingResult.class);
        FieldError fieldError = new FieldError("sqlRequest", "sql", "SQL cannot be empty");
        when(bindingResult.getFieldErrors()).thenReturn(List.of(fieldError));

        MethodArgumentNotValidException ex = mock(MethodArgumentNotValidException.class);
        when(ex.getBindingResult()).thenReturn(bindingResult);

        ResponseEntity<Object> result = handler.handleMethodArgumentNotValid(ex, null, null, null);

        assertEquals(400, result.getStatusCode().value());
        assertNotNull(result.getBody());
        SqlResponse body = (SqlResponse) result.getBody();
        assertFalse(body.isSuccess());
        assertTrue(body.getError().getMessage().contains("sql"));
    }

    @Test
    void shouldHandleGeneralException() {
        var ex = new RuntimeException("some internal error");
        SqlResponse response = handler.handleGeneral(ex);

        assertFalse(response.isSuccess());
        assertEquals("Internal server error", response.getError().getMessage());
    }
}
