package com.douzi.sqlive.service.ai;

import com.douzi.sqlive.dto.ai.AiChatRequest;
import com.douzi.sqlive.dto.ai.AiProviderConfig;
import com.douzi.sqlive.dto.ai.StreamChunk;
import com.sun.net.httpserver.HttpServer;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Branch coverage for {@link OpenAiCompatibleProvider}: history propagation and
 * the production WebClient path (real HTTP against a loopback server, which
 * exercises the Netty connect pipeline incl. the write-timeout handler).
 */
class OpenAiCompatibleProviderBranchTest {

	private final ObjectMapper mapper = new ObjectMapper();

	@Test
	void streamChatForwardsHistoryMessagesToProtocol() {
		var config = createConfig();
		var proto = mock(Protocol.class);
		when(proto.buildRequest(any())).thenReturn(Map.of("model", "test"));
		when(proto.processStream(any())).thenReturn(Flux.just(StreamChunk.text("ok")));
		var webClient = mockWebClientForStream(Flux.just("chunk"));

		var provider = new OpenAiCompatibleProvider(config, webClient, proto, "test", "/chat/completions");
		var history = List.of(chatMessage("user", "earlier question"),
				chatMessage("assistant", "earlier answer"));
		var chunks = provider.streamChat("system", history, "current question").collectList().block();

		assertNotNull(chunks);
		assertEquals(1, chunks.size());
		var ctx = captureRequestContext(proto);
		// system prompt + 2 history entries + current user message
		assertEquals(4, ctx.messages().size());
		assertEquals("assistant", ctx.messages().get(2).get("role"));
		assertEquals("earlier answer", ctx.messages().get(2).get("content"));
		assertEquals("current question", ctx.messages().get(3).get("content"));
	}

	@Test
	void completeUsesProductionWebClientPipelineAgainstRealHttpEndpoint() throws IOException {
		var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		byte[] body = "{\"choices\":[{\"message\":{\"content\":\"real http reply\"}}]}".getBytes(StandardCharsets.UTF_8);
		server.createContext("/", exchange -> {
			exchange.getResponseHeaders().set("Content-Type", "application/json");
			exchange.sendResponseHeaders(200, body.length);
			try (OutputStream os = exchange.getResponseBody()) {
				os.write(body);
			}
		});
		server.start();
		try {
			var config = new AiProviderConfig();
			config.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
			config.setModel("test-model");
			config.setApiKey("sk-real-http");
			var provider = OpenAiCompatibleProvider.create("test", config, mapper,
					Duration.ofSeconds(2), Duration.ofSeconds(5), Duration.ofSeconds(5));
			assertEquals("real http reply", provider.complete("system", "user"));
		} finally {
			server.stop(0);
		}
	}

	@Test
	void isAvailableFalseForBlankApiKeyOrBaseUrl() {
		// protocol that requires an API key: blank key → unavailable
		var proto = new DeepSeekProtocol(mapper);
		var blankKey = new AiProviderConfig();
		blankKey.setBaseUrl("http://localhost:8080");
		blankKey.setApiKey("   ");
		assertFalse(new OpenAiCompatibleProvider(blankKey, proto, "deepseek", "/chat/completions",
				Duration.ofSeconds(5), Duration.ofSeconds(60), Duration.ofSeconds(30)).isAvailable());

		// protocol without key requirement: blank baseUrl → unavailable
		var blankUrl = new AiProviderConfig();
		blankUrl.setBaseUrl("   ");
		assertFalse(new OpenAiCompatibleProvider(blankUrl, new OpenAiProtocol(mapper), "test", "/t",
				Duration.ofSeconds(5), Duration.ofSeconds(60), Duration.ofSeconds(30)).isAvailable());
	}

	private RequestContext captureRequestContext(Protocol proto) {
		var captor = org.mockito.ArgumentCaptor.forClass(RequestContext.class);
		verify(proto).buildRequest(captor.capture());
		return captor.getValue();
	}

	private AiChatRequest.ChatMessage chatMessage(String role, String content) {
		var msg = new AiChatRequest.ChatMessage();
		msg.setRole(role);
		msg.setContent(content);
		return msg;
	}

	private AiProviderConfig createConfig() {
		var config = new AiProviderConfig();
		config.setBaseUrl("http://localhost:8080");
		config.setModel("test-model");
		config.setApiKey("sk-test");
		return config;
	}

	@SuppressWarnings({"unchecked", "rawtypes"})
	private WebClient mockWebClientForStream(Flux<String> responseFlux) {
		WebClient webClient = mock(WebClient.class);
		WebClient.RequestBodyUriSpec uriSpec = mock(WebClient.RequestBodyUriSpec.class);
		WebClient.RequestBodySpec bodySpec = mock(WebClient.RequestBodySpec.class);
		WebClient.RequestHeadersSpec<?> headersSpec = mock(WebClient.RequestHeadersSpec.class);
		WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);

		when(webClient.post()).thenReturn(uriSpec);
		when(uriSpec.uri(anyString())).thenReturn(bodySpec);
		when(bodySpec.bodyValue(any())).thenReturn((WebClient.RequestHeadersSpec) headersSpec);
		when(bodySpec.contentType(any())).thenReturn(bodySpec);
		when(bodySpec.accept(any())).thenReturn(bodySpec);
		when(headersSpec.retrieve()).thenReturn(responseSpec);
		when(responseSpec.bodyToFlux(String.class)).thenReturn(responseFlux);
		return webClient;
	}
}
