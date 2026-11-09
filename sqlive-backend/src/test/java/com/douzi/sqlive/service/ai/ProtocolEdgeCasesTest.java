package com.douzi.sqlive.service.ai;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import org.springframework.http.codec.ServerSentEvent;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Edge cases for the AI wire protocols: optional request fields, empty/null
 * branches, assistant-role history, usage-token fallbacks, and malformed
 * response payloads.
 */
class ProtocolEdgeCasesTest {

	private final ObjectMapper mapper = new ObjectMapper();

	// ── Protocol interface defaults ─────────────────────────

	@Test
	void abbreviateForLogTruncatesLongChunks() {
		String chunk = "x".repeat(Protocol.LOG_CHUNK_MAX_LEN + 50);
		String abbreviated = Protocol.abbreviateForLog(chunk);
		assertEquals(Protocol.LOG_CHUNK_MAX_LEN + "...(truncated)".length(), abbreviated.length());
		assertTrue(abbreviated.endsWith("...(truncated)"));
	}

	@Test
	void abbreviateForLogKeepsShortChunks() {
		assertEquals("short", Protocol.abbreviateForLog("short"));
	}

	@Test
	void defaultParseChunkYieldsEmptyFlux() {
		Protocol bare = new Protocol() {
			@Override
			public Map<String, Object> buildRequest(RequestContext ctx) {
				return Map.of();
			}

			@Override
			public String extractContent(String responseJson) {
				return "";
			}
		};
		var chunks = bare.parseChunk("{\"content\":\"ignored\"}").collectList().block();
		assertNotNull(chunks);
		assertTrue(chunks.isEmpty(), "default parseChunk must not emit anything");
	}

	@Test
	void defaultProcessStreamUnwrapsOnlyDataPrefixedLines() {
		Protocol bare = new Protocol() {
			@Override
			public Map<String, Object> buildRequest(RequestContext ctx) {
				return Map.of();
			}

			@Override
			public String extractContent(String responseJson) {
				return "";
			}
		};
		// A bare JSON line (no "data:" prefix) must pass through untouched.
		var chunks = bare.processStream(Flux.just("{\"content\":\"plain\"}")).collectList().block();
		assertNotNull(chunks);
		assertTrue(chunks.isEmpty());
	}

	// ── LmStudioProtocol ────────────────────────────────────

	@Test
	void lmStudioBuildRequestWithReasoningEffortAndContextLength() {
		var proto = new LmStudioProtocol(mapper);
		var ctx = new RequestContext("m",
				List.of(Map.of("role", "system", "content", "sys"),
						Map.of("role", "user", "content", "hi")),
				100, 0.5, "high", 8192, true);
		var body = proto.buildRequest(ctx);
		assertEquals("high", body.get("reasoning"));
		assertEquals(8192, body.get("context_length"));
	}

	@Test
	void lmStudioBuildRequestWithNullMessagesAndBlankOptionalFields() {
		var proto = new LmStudioProtocol(mapper);
		// blank system prompt and blank reasoning effort must both be omitted
		var ctx = new RequestContext("m",
				List.of(Map.of("role", "system", "content", "   "),
						Map.of("role", "user", "content", "q")),
				100, 0.5, "   ", 0, false);
		var body = proto.buildRequest(ctx);
		assertFalse(body.containsKey("system_prompt"));
		assertFalse(body.containsKey("reasoning"));

		// null message list must be tolerated too
		var nullMsgs = proto.buildRequest(new RequestContext("m", null, 100, 0.5, null, 0, false));
		assertEquals("", nullMsgs.get("input"));
	}

	@Test
	void lmStudioBuildRequestWithEmptyMessagesOmitsSystemPrompt() {
		var proto = new LmStudioProtocol(mapper);
		var body = proto.buildRequest(new RequestContext("m", List.of(), 100, 0.5, null, 0, false));
		assertFalse(body.containsKey("system_prompt"));
		assertEquals("", body.get("input"));
	}

	@Test
	void lmStudioBuildRequestWithoutSystemMessageLabelsHistory() {
		var proto = new LmStudioProtocol(mapper);
		var ctx = new RequestContext("m",
				List.of(Map.of("role", "user", "content", "q"),
						Map.of("role", "assistant", "content", "a"),
						Map.of("role", "user", "content", "next")),
				100, 0.5, null, 0, false);
		var body = proto.buildRequest(ctx);
		assertFalse(body.containsKey("system_prompt"));
		assertEquals("User: q\n\nAssistant: a\n\nUser: next", body.get("input"));
	}

	@Test
	void lmStudioParseEventEmptyDeltasAndEmptyStatsProduceNothing() {
		var proto = new LmStudioProtocol(mapper);
		assertNull(proto.parseEvent(ServerSentEvent.builder("{\"content\":\"\"}").event("message.delta").build()).blockFirst());
		assertNull(proto.parseEvent(ServerSentEvent.builder("{\"content\":\"\"}").event("reasoning.delta").build()).blockFirst());
		assertNull(proto.parseEvent(ServerSentEvent.builder("{\"result\":{\"stats\":{}}}").event("chat.end").build()).blockFirst());
	}

	@Test
	void lmStudioExtractContentJoinsMultipleMessageOutputs() {
		var proto = new LmStudioProtocol(mapper);
		String resp = "{\"output\":[{\"type\":\"message\",\"content\":\"first\"},{\"type\":\"usage\"},{\"type\":\"message\",\"content\":\"second\"}]}";
		assertEquals("first\nsecond", proto.extractContent(resp));
	}

	@Test
	void lmStudioExtractContentEmptyOutputYieldsEmptyString() {
		var proto = new LmStudioProtocol(mapper);
		assertEquals("", proto.extractContent("{\"output\":[]}"));
	}

	@Test
	void lmStudioExtractContentThrowsOnMalformedJson() {
		var proto = new LmStudioProtocol(mapper);
		var ex = assertThrows(RuntimeException.class, () -> proto.extractContent("not json"));
		assertTrue(ex.getMessage().contains("LM Studio response parse failed"));
	}

	@Test
	void lmStudioExtractContentWithNonArrayOutputYieldsEmpty() {
		var proto = new LmStudioProtocol(mapper);
		assertEquals("", proto.extractContent("{\"output\":\"weird\"}"));
	}

	@Test
	void lmStudioExtractContentSkipsMessageWithEmptyContent() {
		var proto = new LmStudioProtocol(mapper);
		assertEquals("", proto.extractContent("{\"output\":[{\"type\":\"message\",\"content\":\"\"}]}"));
	}

	@Test
	void lmStudioParseEventWithoutDataPayloadYieldsNothing() {
		var proto = new LmStudioProtocol(mapper);
		var event = ServerSentEvent.<String>builder().event("message.delta").build();
		assertNull(proto.parseEvent(event).blockFirst());
	}

	// ── OpenAiProtocol ──────────────────────────────────────

	@Test
	void openAiParseChunkResponsesApiStyleDelta() {
		var proto = new OpenAiProtocol(mapper);
		var chunks = proto.parseChunk("{\"output\":[{\"content\":[{\"text\":\"resp-api\"}]}]}")
				.collectList().block();
		assertNotNull(chunks);
		assertEquals(1, chunks.size());
		assertEquals("resp-api", chunks.getFirst().getContent());
	}

	@Test
	void openAiParseChunkResponsesApiEmptyTextYieldsNothing() {
		var proto = new OpenAiProtocol(mapper);
		var chunks = proto.parseChunk("{\"output\":[{\"content\":[{\"text\":\"\"}]}]}")
				.collectList().block();
		assertNotNull(chunks);
		assertTrue(chunks.isEmpty());
	}

	@Test
	void openAiParseChunkUsageFallsBackToInputOutputTokens() {
		var proto = new OpenAiProtocol(mapper);
		var chunks = proto.parseChunk("{\"usage\":{\"input_tokens\":7,\"output_tokens\":3,\"total_tokens\":10}}")
				.collectList().block();
		assertNotNull(chunks);
		assertEquals(1, chunks.size());
		var usage = chunks.getFirst();
		assertEquals("usage", usage.getType());
		assertEquals(7, usage.getPrompt());
		assertEquals(3, usage.getCompletion());
		assertEquals(10, usage.getTotal());
	}

	@Test
	void openAiParseChunkZeroUsageYieldsNothing() {
		var proto = new OpenAiProtocol(mapper);
		var chunks = proto.parseChunk("{\"usage\":{\"prompt_tokens\":0,\"completion_tokens\":0,\"total_tokens\":0}}")
				.collectList().block();
		assertNotNull(chunks);
		assertTrue(chunks.isEmpty());
	}

	@Test
	void openAiExtractContentWithoutChoicesOrOutputReturnsEmpty() {
		var proto = new OpenAiProtocol(mapper);
		assertEquals("", proto.extractContent("{\"model\":\"x\"}"));
	}

	@Test
	void openAiExtractContentThrowsOnMalformedJson() {
		var proto = new OpenAiProtocol(mapper);
		var ex = assertThrows(RuntimeException.class, () -> proto.extractContent("not json"));
		assertTrue(ex.getMessage().contains("AI response parse failed"));
	}

	@Test
	void openAiBuildRequestWithBlankReasoningEffortOmitsField() {
		var proto = new OpenAiProtocol(mapper);
		var ctx = new RequestContext("m", List.of(), 100, 0.5, "   ", 0, false);
		assertFalse(proto.buildRequest(ctx).containsKey("reasoning"));
	}

	@Test
	void openAiParseChunkReasoningVariants() {
		var proto = new OpenAiProtocol(mapper);
		// JSON null reasoning_content → treated as absent
		assertTrue(proto.parseChunk("{\"choices\":[{\"delta\":{\"reasoning_content\":null}}]}")
				.collectList().block().isEmpty());
		// empty-string reasoning → treated as absent
		var empty = proto.parseChunk("{\"choices\":[{\"delta\":{\"reasoning_content\":\"\",\"content\":\"txt\"}}]}")
				.collectList().block();
		assertNotNull(empty);
		assertEquals(1, empty.size());
		assertEquals("text", empty.getFirst().getType());
	}

	@Test
	void openAiParseChunkDegenerateOutputShapes() {
		var proto = new OpenAiProtocol(mapper);
		// empty output array / non-array content / empty content array → no chunks
		assertTrue(proto.parseChunk("{\"output\":[]}").collectList().block().isEmpty());
		assertTrue(proto.parseChunk("{\"output\":[{\"content\":\"str\"}]}").collectList().block().isEmpty());
		assertTrue(proto.parseChunk("{\"output\":[{\"content\":[]}]}").collectList().block().isEmpty());
	}

	@Test
	void openAiParseChunkWithNullUsageNodeYieldsNothing() {
		var proto = new OpenAiProtocol(mapper);
		var chunks = proto.parseChunk("{\"usage\":null}").collectList().block();
		assertNotNull(chunks);
		assertTrue(chunks.isEmpty());
	}

	@Test
	void openAiExtractContentDegenerateShapes() {
		var proto = new OpenAiProtocol(mapper);
		// empty choices falls through to the output path
		assertEquals("", proto.extractContent("{\"choices\":[]}"));
		assertEquals("", proto.extractContent("{\"choices\":[],\"output\":[]}"));
		// output content neither array nor non-empty
		assertEquals("", proto.extractContent("{\"choices\":[],\"output\":[{\"content\":\"str\"}]}"));
		assertEquals("", proto.extractContent("{\"choices\":[],\"output\":[{\"content\":[]}]}"));
		// empty content and empty reasoning both return empty content
		assertEquals("", proto.extractContent("{\"choices\":[{\"message\":{\"content\":\"\",\"reasoning_content\":\"\"}}]}"));
	}

	// ── OllamaProtocol ──────────────────────────────────────

	@Test
	void ollamaBuildRequestWithStringThinkEffortAndContextWindow() {
		var proto = new OllamaProtocol(mapper);
		var ctx = new RequestContext("m", List.of(), 100, 0.5, "medium", 4096, false);
		var body = proto.buildRequest(ctx);
		assertEquals("medium", body.get("think"));
		@SuppressWarnings("unchecked")
		var options = (Map<String, Object>) body.get("options");
		assertEquals(4096, options.get("num_ctx"));
	}

	@Test
	void ollamaParseChunkEmitsThinkingBeforeContent() {
		var proto = new OllamaProtocol(mapper);
		var chunks = proto.parseChunk("{\"message\":{\"thinking\":\"pondering\",\"content\":\"answer\"},\"done\":false}")
				.collectList().block();
		assertNotNull(chunks);
		assertEquals(2, chunks.size());
		assertEquals("reasoning", chunks.get(0).getType());
		assertEquals("pondering", chunks.get(0).getContent());
		assertEquals("text", chunks.get(1).getType());
	}

	@Test
	void ollamaParseChunkDoneWithOnlyEvalCountStillReportsUsage() {
		var proto = new OllamaProtocol(mapper);
		var chunks = proto.parseChunk("{\"message\":{},\"done\":true,\"eval_count\":9}")
				.collectList().block();
		assertNotNull(chunks);
		assertEquals(1, chunks.size());
		assertEquals("usage", chunks.getFirst().getType());
		assertEquals(9, chunks.getFirst().getCompletion());
	}

	@Test
	void ollamaParseChunkDoneWithoutCountsHasNoUsage() {
		var proto = new OllamaProtocol(mapper);
		var chunks = proto.parseChunk("{\"message\":{},\"done\":true}")
				.collectList().block();
		assertNotNull(chunks);
		assertTrue(chunks.isEmpty());
	}

	@Test
	void ollamaExtractContentThrowsOnMalformedJson() {
		var proto = new OllamaProtocol(mapper);
		var ex = assertThrows(RuntimeException.class, () -> proto.extractContent("not json"));
		assertTrue(ex.getMessage().contains("Ollama response parse failed"));
	}

	@Test
	void ollamaBuildRequestWithBlankEffortOmitsThink() {
		var proto = new OllamaProtocol(mapper);
		var ctx = new RequestContext("m", List.of(), 100, 0.5, "   ", 0, false);
		assertFalse(proto.buildRequest(ctx).containsKey("think"));
	}
}
