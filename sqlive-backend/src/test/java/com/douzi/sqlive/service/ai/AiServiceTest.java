package com.douzi.sqlive.service.ai;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.douzi.sqlive.config.AiProperties;
import com.douzi.sqlive.dto.ai.AiChatRequest;
import com.douzi.sqlive.dto.ai.AiProviderConfig;
import com.douzi.sqlive.dto.ai.StreamChunk;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
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

	// ── streamChat error sanitization (D-R0-001 / SEC-02) ───

	@Test
	void streamChatErrorSanitizesAuthorizationHeader() {
		props.getProviders().get("test").setApiKey("sk-test-key-12345");
		when(mockProvider.streamChat(eq("system"), isNull(), eq("hello")))
				.thenReturn(Flux.error(new RuntimeException(
						"Request failed: Authorization: Bearer sk-test-key-12345 status=401")));
		var chunks = service.streamChat("system", null, "hello").collectList().block();
		assertNotNull(chunks);
		assertEquals(1, chunks.size());
		assertEquals("error", chunks.getFirst().getType());
		String payload = chunks.getFirst().getContent();
		assertFalse(payload.contains("sk-test-key-12345"),
				"raw API key must not leak into StreamChunk.error payload");
		assertFalse(payload.contains("Authorization: Bearer sk-test-key-12345"),
				"Authorization header literal must not leak into StreamChunk.error payload");
	}

	@Test
	void streamChatErrorSanitizesRawApiKey() {
		props.getProviders().get("test").setApiKey("sk-raw-key-abc");
		when(mockProvider.streamChat(eq("system"), isNull(), eq("hello")))
				.thenReturn(Flux.error(new RuntimeException(
						"upstream returned 401 for key=sk-raw-key-abc in URL")));
		var chunks = service.streamChat("system", null, "hello").collectList().block();
		assertNotNull(chunks);
		assertEquals(1, chunks.size());
		String payload = chunks.getFirst().getContent();
		assertFalse(payload.contains("sk-raw-key-abc"),
				"raw API key must be redacted in StreamChunk.error payload");
	}

	@Test
	void streamChatErrorLogDoesNotContainFullStackTrace() {
		props.getProviders().get("test").setApiKey("sk-log-key-xyz");
		Logger logger = (Logger) LoggerFactory.getLogger(AiService.class);
		ListAppender<ILoggingEvent> appender = new ListAppender<>();
		appender.start();
		logger.addAppender(appender);
		try {
			when(mockProvider.streamChat(eq("system"), isNull(), eq("hello")))
					.thenReturn(Flux.error(new RuntimeException(
							"Authorization: Bearer sk-log-key-xyz boom")));
			service.streamChat("system", null, "hello").collectList().block();
			var errorEvents = appender.list.stream()
					.filter(e -> e.getLevel() == Level.ERROR)
					.toList();
			assertFalse(errorEvents.isEmpty(), "should emit at least one ERROR log from onErrorResume");
			for (ILoggingEvent ev : errorEvents) {
				assertNull(ev.getThrowableProxy(),
						"log.error must not pass Throwable as last arg (avoids full stack trace in log file)");
				String formatted = ev.getFormattedMessage();
				assertFalse(formatted.contains("Authorization: Bearer sk-log-key-xyz"),
						"Authorization header must be redacted in log output");
				assertFalse(formatted.contains("sk-log-key-xyz"),
						"raw API key must be redacted in log output");
			}
		} finally {
			logger.detachAppender(appender);
		}
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
