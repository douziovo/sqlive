package com.douzi.sqlive.service.ai;

import com.douzi.sqlive.dto.ai.AiProviderConfig;
import com.douzi.sqlive.dto.ai.StreamChunk;
import com.douzi.sqlive.exception.AiProviderException;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.core.io.buffer.DefaultDataBufferFactory;
import org.springframework.http.HttpStatus;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.nio.charset.StandardCharsets;
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
		var p = new OpenAiCompatibleProvider(config, proto, "test", "/test", Duration.ofSeconds(5), Duration.ofSeconds(60), Duration.ofSeconds(30));
		assertTrue(p.isAvailable());
	}

	@Test
	void isAvailableWhenBaseUrlNull() {
		var config = new AiProviderConfig();
		var proto = new OpenAiProtocol(mapper);
		var p = new OpenAiCompatibleProvider(config, proto, "test", "/test", Duration.ofSeconds(5), Duration.ofSeconds(60), Duration.ofSeconds(30));
		assertFalse(p.isAvailable());
	}

	@Test
	void deepSeekIsAvailableWhenApiKeySet() {
		var config = new AiProviderConfig();
		config.setBaseUrl("http://localhost:8080");
		config.setApiKey("sk-test");
		var proto = new DeepSeekProtocol(mapper);
		var p = new OpenAiCompatibleProvider(config, proto, "deepseek", "/chat/completions", Duration.ofSeconds(5), Duration.ofSeconds(60), Duration.ofSeconds(30));
		assertTrue(p.isAvailable());
	}

	@Test
	void deepSeekNotAvailableWhenApiKeyMissing() {
		var config = new AiProviderConfig();
		config.setBaseUrl("http://localhost:8080");
		var proto = new DeepSeekProtocol(mapper);
		var p = new OpenAiCompatibleProvider(config, proto, "deepseek", "/chat/completions", Duration.ofSeconds(5), Duration.ofSeconds(60), Duration.ofSeconds(30));
		assertFalse(p.isAvailable());
	}

	// ── getProviderName ──────────────────────────────────────

	@Test
	void getProviderNameReturnsCorrectName() {
		var config = new AiProviderConfig();
		config.setBaseUrl("http://localhost:8080");
		var proto = new OpenAiProtocol(mapper);
		var p = new OpenAiCompatibleProvider(config, proto, "test-provider", "/test", Duration.ofSeconds(5), Duration.ofSeconds(60), Duration.ofSeconds(30));
		assertEquals("test-provider", p.getProviderName());
	}

	// ── complete() ───────────────────────────────────────────

	@Test
	void completeReturnsExtractedContent() {
		var config = createConfig();
		var proto = mock(Protocol.class);
		var webClient = mockWebClientForComplete();
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
		assertEquals("hello", chunks.getFirst().getContent());
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
		assertEquals("error", chunks.getFirst().getType());
	}

	// ── helpers ──────────────────────────────────────────────
	@Test
	void lmStudioUsesSpringSseDecoderForFragmentedNamedEvents() {
		String wire = """
				event: message.delta
				: heartbeat
				data: {"content":
				data: "中文🙂"}

				event: reasoning.delta
				data: {"content":"thinking"}

				event: message.delta
				data: {"content":"done"}

				""".replace("\n", "\r\n");
		byte[] bytes = wire.getBytes(StandardCharsets.UTF_8);
		var buffers = new DefaultDataBufferFactory();
		var client = WebClient.builder().exchangeFunction(request -> Mono.just(
				ClientResponse.create(HttpStatus.OK).header("Content-Type", "text/event-stream")
						.body(Flux.range(0, bytes.length).map(i -> buffers.wrap(new byte[]{bytes[i]})))
						.build())).build();
		var provider = new OpenAiCompatibleProvider(createConfig(), client, new LmStudioProtocol(mapper),
				"lmstudio", "/api/v1/chat");
		var chunks = provider.streamChat("system", null, "user").collectList().block(Duration.ofSeconds(5));
		assertNotNull(chunks);
		assertEquals(3, chunks.size());
		assertEquals("中文🙂", chunks.getFirst().getContent());
		assertEquals("reasoning", chunks.get(1).getType());
		assertEquals("done", chunks.get(2).getContent());
	}

	private AiProviderConfig createConfig() {
		var config = new AiProviderConfig();
		config.setBaseUrl("http://localhost:8080");
		config.setModel("test-model");
		config.setApiKey("sk-test");
		return config;
	}

	@SuppressWarnings({"unchecked", "rawtypes"})
	private MockWebClientCore mockWebClientCore() {
		WebClient webClient = mock(WebClient.class);
		WebClient.RequestBodyUriSpec uriSpec = mock(WebClient.RequestBodyUriSpec.class);
		WebClient.RequestBodySpec bodySpec = mock(WebClient.RequestBodySpec.class);
		WebClient.RequestHeadersSpec<?> headersSpec = mock(WebClient.RequestHeadersSpec.class);
		WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);

		when(webClient.post()).thenReturn(uriSpec);
		when(uriSpec.uri(anyString())).thenReturn(bodySpec);
		when(bodySpec.bodyValue(any())).thenReturn((WebClient.RequestHeadersSpec) headersSpec);
		when(headersSpec.retrieve()).thenReturn(responseSpec);

		return new MockWebClientCore(webClient, uriSpec, bodySpec, headersSpec, responseSpec);
	}

	private WebClient mockWebClientForComplete() {
		MockWebClientCore core = mockWebClientCore();
		when(core.responseSpec().bodyToMono(String.class)).thenReturn(Mono.just("{\"summary\":\"ok\"}"));
		return core.webClient();
	}

	private WebClient mockWebClientThatThrows(RuntimeException ex) {
		MockWebClientCore core = mockWebClientCore();
		when(core.responseSpec().bodyToMono(String.class)).thenThrow(ex);
		return core.webClient();
	}

	private WebClient mockWebClientForStream(Flux<String> responseFlux) {
		MockWebClientCore core = mockWebClientCore();
		when(core.bodySpec().contentType(any())).thenReturn(core.bodySpec());
		when(core.bodySpec().accept(any())).thenReturn(core.bodySpec());
		when(core.responseSpec().bodyToFlux(String.class)).thenReturn(responseFlux);
		return core.webClient();
	}

	private record MockWebClientCore(
			WebClient webClient,
			WebClient.RequestBodyUriSpec uriSpec,
			WebClient.RequestBodySpec bodySpec,
			WebClient.RequestHeadersSpec<?> headersSpec,
			WebClient.ResponseSpec responseSpec) {
	}
}
