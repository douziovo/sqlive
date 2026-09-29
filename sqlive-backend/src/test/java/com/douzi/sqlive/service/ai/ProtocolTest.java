package com.douzi.sqlive.service.ai;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import org.springframework.http.codec.ServerSentEvent;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ProtocolTest {

	private final ObjectMapper mapper = new ObjectMapper();

	private static RequestContext ctx(boolean stream) {
		return new RequestContext("test-model",
				List.of(Map.of("role", "system", "content", "You are helpful"),
						Map.of("role", "user", "content", "Hello")),
				2048, 0.3, null, 0, stream);
	}

	// ── OpenAiProtocol ──────────────────────────────────────

	@Test
	void openAiBuildRequestNonStreaming() {
		var proto = new OpenAiProtocol(mapper);
		var body = proto.buildRequest(ctx(false));
		assertEquals("test-model", body.get("model"));
		assertEquals(Boolean.FALSE, body.get("stream"));
		assertEquals(2048, body.get("max_tokens"));
		assertEquals(0.3, body.get("temperature"));
		@SuppressWarnings("unchecked")
		var messages = (List<Map<String, String>>) body.get("messages");
		assertEquals(2, messages.size());
	}

	@Test
	void openAiBuildRequestStreaming() {
		var proto = new OpenAiProtocol(mapper);
		var body = proto.buildRequest(ctx(true));
		assertEquals(Boolean.TRUE, body.get("stream"));
	}

	@Test
	void openAiBuildRequestWithReasoningEffort() {
		var proto = new OpenAiProtocol(mapper);
		var ctx = new RequestContext("m", List.of(), 100, 0.5, "high", 0, false);
		@SuppressWarnings("unchecked")
		var reasoning = (Map<String, Object>) proto.buildRequest(ctx).get("reasoning");
		assertNotNull(reasoning);
		assertEquals("high", reasoning.get("effort"));
	}

	@Test
	void openAiExtractContentChatCompletions() {
		var proto = new OpenAiProtocol(mapper);
		String response = "{\"choices\":[{\"message\":{\"content\":\"Hello world\"}}]}";
		assertEquals("Hello world", proto.extractContent(response));
	}

	@Test
	void openAiExtractContentReasoningFallback() {
		var proto = new OpenAiProtocol(mapper);
		String response = "{\"choices\":[{\"message\":{\"content\":\"\",\"reasoning_content\":\"Thinking...\"}}]}";
		assertEquals("Thinking...", proto.extractContent(response));
	}

	@Test
	void openAiExtractContentResponsesApi() {
		var proto = new OpenAiProtocol(mapper);
		String response = "{\"output\":[{\"content\":[{\"text\":\"Hi\"}]}]}";
		assertEquals("Hi", proto.extractContent(response));
	}

	@Test
	void openAiParseChunkText() {
		var proto = new OpenAiProtocol(mapper);
		String sse = "{\"choices\":[{\"delta\":{\"content\":\"hello\"}}]}";
		var chunks = proto.parseChunk(sse).collectList().block();
		assertNotNull(chunks);
		assertEquals(1, chunks.size());
		assertEquals("text", chunks.getFirst().getType());
		assertEquals("hello", chunks.getFirst().getContent());
	}

	@Test
	void openAiParseChunkReasoning() {
		var proto = new OpenAiProtocol(mapper);
		String sse = "{\"choices\":[{\"delta\":{\"reasoning_content\":\"hmm\"}}]}";
		var chunks = proto.parseChunk(sse).collectList().block();
		assertNotNull(chunks);
		assertEquals(1, chunks.size());
		assertEquals("reasoning", chunks.getFirst().getType());
	}

	@Test
	void openAiParseChunkEmpty() {
		var proto = new OpenAiProtocol(mapper);
		String sse = "{\"choices\":[{\"delta\":{\"content\":\"\"}}]}";
		var chunks = proto.parseChunk(sse).collectList().block();
		assertNotNull(chunks);
		assertEquals(0, chunks.size());
	}

	@Test
	void openAiParseChunkUsage() {
		var proto = new OpenAiProtocol(mapper);
		String sse = "{\"choices\":[],\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":20,\"total_tokens\":30}}";
		var chunks = proto.parseChunk(sse).collectList().block();
		assertNotNull(chunks);
		assertTrue(chunks.stream().anyMatch(c -> "usage".equals(c.getType())));
	}

	@Test
	void openAiParseChunkInvalidJson() {
		var proto = new OpenAiProtocol(mapper);
		var chunks = proto.parseChunk("not json").collectList().block();
		assertNotNull(chunks);
		assertEquals(0, chunks.size());
	}

	@Test
	void openAiProcessStreamFiltersEmptyAndDone() {
		var proto = new OpenAiProtocol(mapper);
		var lines = Flux.just("", "  ", "[DONE]", "data: {\"choices\":[{\"delta\":{\"content\":\"x\"}}]}");
		var chunks = proto.processStream(lines).collectList().block();
		assertNotNull(chunks);
		assertEquals(1, chunks.size());
		assertEquals("x", chunks.getFirst().getContent());
	}

	// ── DeepSeekProtocol ────────────────────────────────────

	@Test
	void deepSeekBuildRequestAddsThinking() {
		var proto = new DeepSeekProtocol(mapper);
		var body = proto.buildRequest(ctx(false));
		@SuppressWarnings("unchecked")
		var thinking = (Map<String, Object>) body.get("thinking");
		assertNotNull(thinking);
		assertEquals("enabled", thinking.get("type"));
	}

	@Test
	void deepSeekRequiresApiKey() {
		var proto = new DeepSeekProtocol(mapper);
		assertTrue(proto.requiresApiKey());
	}

	// ── OllamaProtocol ──────────────────────────────────────

	@Test
	void ollamaBuildRequestHasOptions() {
		var proto = new OllamaProtocol(mapper);
		var body = proto.buildRequest(ctx(false));
		assertEquals("test-model", body.get("model"));
		@SuppressWarnings("unchecked")
		var options = (Map<String, Object>) body.get("options");
		assertNotNull(options);
		assertEquals(2048, options.get("num_predict"));
	}

	@Test
	void ollamaBuildRequestWithThinkTrue() {
		var proto = new OllamaProtocol(mapper);
		var ctx = new RequestContext("m", List.of(), 100, 0.5, "true", 0, false);
		assertEquals(true, proto.buildRequest(ctx).get("think"));
	}

	@Test
	void ollamaExtractContent() {
		var proto = new OllamaProtocol(mapper);
		assertEquals("hi", proto.extractContent("{\"message\":{\"content\":\"hi\"}}"));
	}

	@Test
	void ollamaParseChunkContent() {
		var proto = new OllamaProtocol(mapper);
		var chunks = proto.parseChunk("{\"message\":{\"content\":\"hello\"},\"done\":false}")
				.collectList().block();
		assertNotNull(chunks);
		assertEquals(1, chunks.size());
		assertEquals("hello", chunks.getFirst().getContent());
	}

	@Test
	void ollamaParseChunkDoneWithUsage() {
		var proto = new OllamaProtocol(mapper);
		var chunks = proto.parseChunk(
						"{\"message\":{\"content\":\"\"},\"done\":true,\"prompt_eval_count\":5,\"eval_count\":15}")
				.collectList().block();
		assertNotNull(chunks);
		assertTrue(chunks.stream().anyMatch(c -> "usage".equals(c.getType())));
	}

	@Test
	void ollamaParseChunkInvalidJson() {
		var proto = new OllamaProtocol(mapper);
		var chunks = proto.parseChunk("not json").collectList().block();
		assertNotNull(chunks);
		assertEquals(0, chunks.size());
	}

	@Test
	void ollamaProcessStreamSkipsEmpty() {
		var proto = new OllamaProtocol(mapper);
		var chunks = proto.processStream(Flux.just("", "  ", "{\"message\":{\"content\":\"x\"},\"done\":false}"))
				.collectList().block();
		assertNotNull(chunks);
		assertEquals(1, chunks.size());
	}

	// ── LmStudioProtocol ────────────────────────────────────

	@Test
	void lmStudioBuildRequestUsesInput() {
		var proto = new LmStudioProtocol(mapper);
		var body = proto.buildRequest(ctx(false));
		assertEquals("test-model", body.get("model"));
		assertTrue(body.containsKey("system_prompt"));
		assertTrue(body.get("input").toString().contains("Hello"));
	}

	@Test
	void lmStudioExtractContent() {
		var proto = new LmStudioProtocol(mapper);
		String resp = "{\"output\":[{\"type\":\"message\",\"content\":\"result\"}]}";
		assertEquals("result", proto.extractContent(resp));
	}

	@Test
	void lmStudioParsesNamedEvents() {
		var proto = new LmStudioProtocol(mapper);
		var text = proto.parseEvent(ServerSentEvent.builder("{\"content\":\"hello\"}").event("message.delta").build()).blockFirst();
		assertNotNull(text);
		assertEquals("hello", text.getContent());
		var reasoning = proto.parseEvent(ServerSentEvent.builder("{\"content\":\"thinking\"}").event("reasoning.delta").build()).blockFirst();
		assertNotNull(reasoning);
		assertEquals("reasoning", reasoning.getType());
		var usage = proto.parseEvent(ServerSentEvent.builder("{\"result\":{\"stats\":{\"input_tokens\":5,\"total_output_tokens\":10}}}").event("chat.end").build()).blockFirst();
		assertNotNull(usage);
		assertEquals("usage", usage.getType());
		var error = proto.parseEvent(ServerSentEvent.builder("{\"error\":{\"message\":\"bad\"}}").event("error").build()).blockFirst();
		assertNotNull(error);
		assertEquals("bad", error.getContent());
	}

	@Test
	void lmStudioSkipsUnknownEmptyAndMalformedEvents() {
		var proto = new LmStudioProtocol(mapper);
		assertNull(proto.parseEvent(ServerSentEvent.builder("{}").event("unknown").build()).blockFirst());
		assertNull(proto.parseEvent(ServerSentEvent.<String>builder().comment("heartbeat").build()).blockFirst());
		assertNull(proto.parseEvent(ServerSentEvent.builder("not json").event("message.delta").build()).blockFirst());
	}
}
