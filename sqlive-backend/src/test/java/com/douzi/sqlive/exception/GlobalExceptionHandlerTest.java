package com.douzi.sqlive.exception;

import com.douzi.sqlive.dto.ai.AiChatResponse;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

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
}
