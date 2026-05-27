package com.douzi.sqlive.service.ai;

import com.douzi.sqlive.config.AiProperties;
import com.douzi.sqlive.dto.ai.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AiServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private AiProperties props;
    private AiService service;
    private AiProvider mockProvider;

    @BeforeEach
    void setUp() {
        props = new AiProperties();
        props.setProvider("test");
        var config = new AiProviderConfig();
        config.setBaseUrl("http://localhost:8080");
        config.setModel("test-model");
        props.setProviders(Map.of("test", config));

        mockProvider = mock(AiProvider.class);
        when(mockProvider.getProviderName()).thenReturn("test");
        when(mockProvider.isAvailable()).thenReturn(true);

        service = new AiService(props, mapper);
        service.providers = Map.of("test", mockProvider);
    }

    // ── getProvider ─────────────────────────────────────────

    @Test
    void getProviderShouldReturnConfiguredProvider() {
        var provider = invokeGetProvider();
        assertEquals("test", provider.getProviderName());
    }

    @Test
    void getProviderShouldThrowWhenNotFound() {
        props.setProvider("nonexistent");
        var ex = assertThrows(RuntimeException.class, this::invokeGetProvider);
        assertTrue(ex.getMessage().contains("nonexistent"));
    }

    @Test
    void getProviderShouldThrowWhenNotAvailable() {
        when(mockProvider.isAvailable()).thenReturn(false);
        var ex = assertThrows(RuntimeException.class, this::invokeGetProvider);
        assertTrue(ex.getMessage().contains("test"));
    }

    // ── executeNonStreaming ──────────────────────────────────

    @Test
    void executeNonStreamingSuccess() {
        when(mockProvider.complete(anyString(), anyString()))
                .thenReturn("{\"summary\":\"done\",\"detail\":\"result\"}");
        var resp = service.executeNonStreaming("chat", "system", "user");
        assertTrue(resp.isSuccess());
        assertEquals("result", resp.getData().getContent());
        assertEquals("done", resp.getData().getSummary());
    }

    @Test
    void executeNonStreamingProviderError() {
        when(mockProvider.complete(anyString(), anyString()))
                .thenThrow(new RuntimeException("boom"));
        var resp = service.executeNonStreaming("chat", "system", "user");
        assertFalse(resp.isSuccess());
        assertNotNull(resp.getError());
    }

    @Test
    void executeNonStreamingNonJsonResponse() {
        when(mockProvider.complete(anyString(), anyString())).thenReturn("Just plain text");
        var resp = service.executeNonStreaming("chat", "system", "user");
        assertTrue(resp.isSuccess());
        assertEquals("Just plain text", resp.getData().getContent());
    }

    // ── streamChat ───────────────────────────────────────────

    @Test
    void streamChatSuccess() {
        when(mockProvider.streamChat(eq("system"), isNull(), eq("hello")))
                .thenReturn(Flux.just(StreamChunk.text("a"), StreamChunk.text("b")));
        var chunks = service.streamChat("system", null, "hello").collectList().block();
        assertNotNull(chunks);
        assertEquals(2, chunks.size());
    }

    @Test
    void streamChatError() {
        when(mockProvider.streamChat(eq("system"), isNull(), eq("hello")))
                .thenReturn(Flux.error(new RuntimeException("stream failed")));
        var chunks = service.streamChat("system", null, "hello").collectList().block();
        assertNotNull(chunks);
        assertEquals(1, chunks.size());
        assertEquals("error", chunks.getFirst().getType());
    }

    // ── buildSystemPrompt ────────────────────────────────────

    @Test
    void buildSystemPromptForExplainMode() {
        var req = new AiChatRequest();
        req.setMode("explain");
        req.setCurrentSql("SELECT 1");
        req.setSelectedCode("SELECT 1");
        var prompt = service.buildSystemPrompt(req);
        assertTrue(prompt.contains("解释"));
    }

    @Test
    void buildSystemPromptForFixCodeMode() {
        var req = new AiChatRequest();
        req.setMode("fix-code");
        req.setCurrentSql("SELECT * FORM users");
        var err = new AiChatRequest.ErrorInfo();
        err.setMessage("near FORM");
        err.setLine(2);
        req.setError(err);
        var prompt = service.buildSystemPrompt(req);
        assertTrue(prompt.contains("FORM"));
    }

    @Test
    void buildSystemPromptForChatMode() {
        var req = new AiChatRequest();
        req.setMode("chat");
        req.setCurrentSql("SELECT 1");
        var prompt = service.buildSystemPrompt(req);
        assertTrue(prompt.contains("SQL"));
    }

    // ── buildUserMessage ─────────────────────────────────────

    @Test
    void buildUserMessageForChat() {
        var req = new AiChatRequest();
        req.setMode("chat");
        req.setMessage("What is SQL?");
        assertEquals("What is SQL?", service.buildUserMessage(req));
    }

    @Test
    void buildUserMessageForAnalyzeError() {
        var req = new AiChatRequest();
        req.setMode("analyze-error");
        assertEquals("", service.buildUserMessage(req));
    }

    // ── helpers ──────────────────────────────────────────────

    private AiProvider invokeGetProvider() {
        return service.getProvider();
    }
}
