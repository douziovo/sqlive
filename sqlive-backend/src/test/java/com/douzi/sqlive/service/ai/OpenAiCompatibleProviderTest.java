package com.douzi.sqlive.service.ai;

import com.douzi.sqlive.dto.ai.AiProviderConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class OpenAiCompatibleProviderTest {

    private final ObjectMapper mapper = new ObjectMapper();

    // ── isAvailable ──────────────────────────────────────────

    @Test
    void isAvailableWhenBaseUrlSet() {
        var config = new AiProviderConfig();
        config.setBaseUrl("http://localhost:8080");
        var proto = new OpenAiProtocol(mapper);
        var p = new OpenAiCompatibleProvider(config, proto, "test", "/test");
        assertTrue(p.isAvailable());
    }

    @Test
    void isAvailableWhenBaseUrlNull() {
        var config = new AiProviderConfig();
        var proto = new OpenAiProtocol(mapper);
        var p = new OpenAiCompatibleProvider(config, proto, "test", "/test");
        assertFalse(p.isAvailable());
    }

    @Test
    void deepSeekIsAvailableWhenApiKeySet() {
        var config = new AiProviderConfig();
        config.setBaseUrl("http://localhost:8080");
        config.setApiKey("sk-test");
        var proto = new DeepSeekProtocol(mapper);
        var p = new OpenAiCompatibleProvider(config, proto, "deepseek", "/chat/completions");
        assertTrue(p.isAvailable());
    }

    @Test
    void deepSeekNotAvailableWhenApiKeyMissing() {
        var config = new AiProviderConfig();
        config.setBaseUrl("http://localhost:8080");
        var proto = new DeepSeekProtocol(mapper);
        var p = new OpenAiCompatibleProvider(config, proto, "deepseek", "/chat/completions");
        assertFalse(p.isAvailable());
    }

    // ── getProviderName ──────────────────────────────────────

    @Test
    void getProviderNameReturnsCorrectName() {
        var config = new AiProviderConfig();
        config.setBaseUrl("http://localhost:8080");
        var proto = new OpenAiProtocol(mapper);
        var p = new OpenAiCompatibleProvider(config, proto, "test-provider", "/test");
        assertEquals("test-provider", p.getProviderName());
    }
}
