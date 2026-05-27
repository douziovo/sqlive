package com.douzi.sqlive.service.ai;

import com.douzi.sqlive.dto.ai.AiProviderConfig;
import com.douzi.sqlive.dto.ai.StreamChunk;
import com.douzi.sqlive.exception.AiProviderException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

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

    // ── complete() ───────────────────────────────────────────

    @Test
    void completeReturnsExtractedContent() {
        var config = createConfig();
        var proto = mock(Protocol.class);
        var webClient = mockWebClientForComplete("{\"summary\":\"ok\"}");
        when(proto.buildRequest(any())).thenReturn(Map.of("model", "test"));
        when(proto.extractContent(anyString())).thenReturn("extracted content");

        var provider = new OpenAiCompatibleProvider(config, webClient, proto, "test", "/chat/completions");
        String result = provider.complete("system prompt", "user message");

        assertEquals("extracted content", result);
        verify(proto).buildRequest(any());
        verify(proto).extractContent("{\"summary\":\"ok\"}");
    }

    @Test
    void completeThrowsAiProviderExceptionOnHttpError() {
        var config = createConfig();
        var proto = mock(Protocol.class);
        var webClient = mockWebClientThatThrows(new RuntimeException("Connection refused"));
        when(proto.buildRequest(any())).thenReturn(Map.of("model", "test"));

        var provider = new OpenAiCompatibleProvider(config, webClient, proto, "test", "/chat/completions");
        var ex = assertThrows(AiProviderException.class,
                () -> provider.complete("system", "user"));
        assertTrue(ex.getMessage().contains("Connection refused"));
    }

    // ── streamChat() ─────────────────────────────────────────

    @Test
    void streamChatReturnsFluxOfChunks() {
        var config = createConfig();
        var proto = mock(Protocol.class);
        when(proto.buildRequest(any())).thenReturn(Map.of("model", "test"));
        when(proto.processStream(any())).thenReturn(
                Flux.just(StreamChunk.text("hello"), StreamChunk.text(" world")));

        var webClient = mockWebClientForStream(Flux.just("chunk1", "chunk2"));

        var provider = new OpenAiCompatibleProvider(config, webClient, proto, "test", "/chat/completions");
        var chunks = provider.streamChat("system", null, "user").collectList().block();

        assertNotNull(chunks);
        assertEquals(2, chunks.size());
        assertEquals("hello", chunks.get(0).getContent());
    }

    @Test
    void streamChatHandlesError() {
        var config = createConfig();
        var proto = mock(Protocol.class);
        when(proto.buildRequest(any())).thenReturn(Map.of("model", "test"));
        when(proto.processStream(any())).thenAnswer(inv -> inv.getArgument(0));

        var webClient = mockWebClientForStream(
                Flux.error(new RuntimeException("Stream broken")));

        var provider = new OpenAiCompatibleProvider(config, webClient, proto, "test", "/chat/completions");
        var chunks = provider.streamChat("system", null, "user")
                .onErrorResume(e -> Flux.just(StreamChunk.error(e.getMessage())))
                .collectList().block();

        assertNotNull(chunks);
        assertEquals(1, chunks.size());
        assertEquals("error", chunks.get(0).getType());
    }

    // ── helpers ──────────────────────────────────────────────

    private AiProviderConfig createConfig() {
        var config = new AiProviderConfig();
        config.setBaseUrl("http://localhost:8080");
        config.setModel("test-model");
        config.setApiKey("sk-test");
        return config;
    }

    @SuppressWarnings("unchecked")
    private WebClient mockWebClientForComplete(String responseBody) {
        WebClient webClient = mock(WebClient.class);
        WebClient.RequestBodyUriSpec uriSpec = mock(WebClient.RequestBodyUriSpec.class);
        WebClient.RequestBodySpec bodySpec = mock(WebClient.RequestBodySpec.class);
        WebClient.RequestHeadersSpec<?> headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);

        when(webClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.bodyValue(any())).thenReturn((WebClient.RequestHeadersSpec) headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(String.class)).thenReturn(Mono.just(responseBody));

        return webClient;
    }

    @SuppressWarnings("unchecked")
    private WebClient mockWebClientThatThrows(RuntimeException ex) {
        WebClient webClient = mock(WebClient.class);
        WebClient.RequestBodyUriSpec uriSpec = mock(WebClient.RequestBodyUriSpec.class);
        WebClient.RequestBodySpec bodySpec = mock(WebClient.RequestBodySpec.class);
        WebClient.RequestHeadersSpec<?> headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);

        when(webClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.bodyValue(any())).thenReturn((WebClient.RequestHeadersSpec) headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(String.class)).thenThrow(ex);

        return webClient;
    }

    @SuppressWarnings("unchecked")
    private WebClient mockWebClientForStream(Flux<String> responseFlux) {
        WebClient webClient = mock(WebClient.class);
        WebClient.RequestBodyUriSpec uriSpec = mock(WebClient.RequestBodyUriSpec.class);
        WebClient.RequestBodySpec bodySpec = mock(WebClient.RequestBodySpec.class);
        WebClient.RequestHeadersSpec<?> headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);

        when(webClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.accept(any())).thenReturn(bodySpec);
        when(bodySpec.bodyValue(any())).thenReturn((WebClient.RequestHeadersSpec) headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToFlux(String.class)).thenReturn(responseFlux);

        return webClient;
    }
}
