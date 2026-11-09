package com.douzi.sqlive.controller;

import com.douzi.sqlive.dto.ai.AiChatRequest;
import com.douzi.sqlive.dto.ai.AiChatResponse;
import com.douzi.sqlive.dto.ai.StreamChunk;
import com.douzi.sqlive.service.ai.AiService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import reactor.core.publisher.Flux;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AiControllerTest {

	private final RestTemplate restTemplate = new RestTemplate();
	@Value("${local.server.port}")
	private int port;
	@Autowired
	private AiService aiService;

	private String url(String path) {
		return "http://localhost:" + port + path;
	}

	private HttpHeaders jsonHeaders() {
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		return headers;
	}

	@Test
	void chatShouldReturnStreamingResponse() {
		AiChatRequest req = new AiChatRequest();
		req.setMode("chat");
		req.setMessage("Hello");
		req.setStream(true);

		HttpHeaders headers = jsonHeaders();
		headers.setAccept(List.of(MediaType.TEXT_EVENT_STREAM));
		HttpEntity<AiChatRequest> entity = new HttpEntity<>(req, headers);

		ResponseEntity<String> resp = restTemplate.exchange(
				url("/api/ai/chat"), HttpMethod.POST, entity, String.class);

		assertEquals(HttpStatus.OK, resp.getStatusCode());
		assertNotNull(resp.getBody());
		assertTrue(resp.getBody().contains("hello"), "SSE response should contain 'hello' chunk content");
		assertTrue(resp.getBody().contains("world"), "SSE response should contain 'world' chunk content");
	}

	@Test
	void chatAcceptsTheFrontendNonStreamingJsonContract() {
		AiChatRequest req = new AiChatRequest();
		req.setMessage("Generate a SQLite table");
		req.setStream(false);
		HttpHeaders headers = jsonHeaders();
		headers.setAccept(List.of(MediaType.APPLICATION_JSON));
		ResponseEntity<AiChatResponse> resp = restTemplate.exchange(
				url("/api/ai/chat"), HttpMethod.POST, new HttpEntity<>(req, headers), AiChatResponse.class);
		assertEquals(HttpStatus.OK, resp.getStatusCode());
		assertTrue(resp.getHeaders().getContentType().isCompatibleWith(MediaType.APPLICATION_JSON));
		assertTrue(resp.getBody().isSuccess());
		assertEquals("AI response", resp.getBody().getData().getContent());
	}

	@Test
	void chatJsonPreservesProviderErrorPayload() {
		AiChatRequest req = new AiChatRequest();
		req.setMessage("json error contract");
		req.setStream(false);
		when(aiService.executeNonStreaming(argThat(r -> r != null && "json error contract".equals(r.getMessage()))))
				.thenReturn(AiChatResponse.error("provider unavailable"));
		HttpHeaders headers = jsonHeaders();
		headers.setAccept(List.of(MediaType.APPLICATION_JSON));
		var resp = restTemplate.exchange(url("/api/ai/chat"), HttpMethod.POST,
				new HttpEntity<>(req, headers), AiChatResponse.class);
		assertEquals(HttpStatus.OK, resp.getStatusCode());
		assertFalse(resp.getBody().isSuccess());
		assertEquals("provider unavailable", resp.getBody().getError().getMessage());
	}

	// ── /api/ai/chat (streaming) ─────────────────────────────

	@Test
	void analyzeErrorShouldReturnResponse() {
		AiChatRequest req = new AiChatRequest();
		req.setMode("analyze-error");
		req.setCurrentSql("SELECT * FORM users");
		var err = new AiChatRequest.ErrorInfo();
		err.setMessage("syntax error");
		err.setLine(1);
		req.setError(err);

		HttpEntity<AiChatRequest> entity = new HttpEntity<>(req, jsonHeaders());

		ResponseEntity<AiChatResponse> resp = restTemplate.exchange(
				url("/api/ai/analyze-error"), HttpMethod.POST, entity, AiChatResponse.class);

		assertEquals(HttpStatus.OK, resp.getStatusCode());
		assertNotNull(resp.getBody());
		assertTrue(resp.getBody().isSuccess());
	}

	// ── /api/ai/analyze-error ────────────────────────────────

	@Test
	void explainShouldReturnResponse() {
		AiChatRequest req = new AiChatRequest();
		req.setMode("explain");
		req.setMessage("SELECT 1");

		HttpEntity<AiChatRequest> entity = new HttpEntity<>(req, jsonHeaders());

		ResponseEntity<AiChatResponse> resp = restTemplate.exchange(
				url("/api/ai/explain"), HttpMethod.POST, entity, AiChatResponse.class);

		assertEquals(HttpStatus.OK, resp.getStatusCode());
		assertNotNull(resp.getBody());
		assertTrue(resp.getBody().isSuccess());
	}

	// ── /api/ai/explain ──────────────────────────────────────

	@TestConfiguration
	static class MockConfig {
		@Bean
		@Primary
		AiService mockAiService() {
			var mock = mock(AiService.class);

			var resp = new AiChatResponse();
			resp.setSuccess(true);
			var data = new AiChatResponse.DataPayload();
			data.setContent("AI response");
			data.setSummary("summary");
			resp.setData(data);
			when(mock.executeNonStreaming(argThat(req -> req != null && req.getMode() != null))).thenReturn(resp);

			when(mock.streamChat(argThat(req -> req != null && req.getMode() != null)))
					.thenReturn(Flux.just(StreamChunk.text("hello"), StreamChunk.text(" world")));

			return mock;
		}
	}
}
