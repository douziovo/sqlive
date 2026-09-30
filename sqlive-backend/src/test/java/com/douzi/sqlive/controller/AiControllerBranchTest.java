package com.douzi.sqlive.controller;

import com.douzi.sqlive.dto.ai.AiChatRequest;
import com.douzi.sqlive.dto.ai.AiChatResponse;
import com.douzi.sqlive.dto.ai.StreamChunk;
import com.douzi.sqlive.service.ai.AiService;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.*;

class AiControllerBranchTest {
	private final AiService service = mock(AiService.class);
	private final AiController controller = new AiController(service);

	@Test
	void nonStreamingChatReturnsContentAndCompletion() {
		var request = new AiChatRequest();
		request.setStream(false);
		var response = new AiChatResponse();
		response.setSuccess(true);
		var data = new AiChatResponse.DataPayload();
		data.setContent("answer");
		response.setData(data);
		when(service.executeNonStreaming(same(request))).thenReturn(response);

		var chunks = controller.chat(request).collectList().block();
		assertEquals("chat", request.getMode());
		assertEquals("answer", chunks.getFirst().getContent());
		assertEquals("done", chunks.getLast().getType());
	}

	@Test
	void nonStreamingChatReturnsProviderError() {
		var request = new AiChatRequest();
		request.setStream(false);
		when(service.executeNonStreaming(same(request))).thenReturn(AiChatResponse.error("unavailable"));
		assertEquals("unavailable", controller.chat(request).blockFirst().getContent());
	}

	@Test
	void streamingChatReturnsSafeErrorAndCompletion() {
		var request = new AiChatRequest();
		when(service.streamChat(same(request))).thenReturn(Flux.error(new IllegalStateException("secret")));
		var chunks = controller.chat(request).collectList().block();
		assertEquals("chat", request.getMode());
		assertEquals("error", chunks.getFirst().getType());
		assertEquals("AI service error, please try again later", chunks.getFirst().getContent());
		assertEquals("done", chunks.getLast().getType());
	}

	@Test
	void fixAndOptimizeUseExpectedModesAndReturnProviderResult() {
		var emptySuccess = new AiChatResponse();
		emptySuccess.setSuccess(true);
		var fix = new AiChatRequest();
		when(service.executeNonStreaming(same(fix))).thenReturn(emptySuccess);
		assertSame(emptySuccess, controller.fixCode(fix));
		assertEquals("fix-code", fix.getMode());

		var failure = AiChatResponse.error("provider unavailable");
		var optimize = new AiChatRequest();
		when(service.executeNonStreaming(same(optimize))).thenReturn(failure);
		assertSame(failure, controller.optimize(optimize));
		assertEquals("optimize", optimize.getMode());
	}

	@Test
	void failedAnalysisWithoutErrorPayloadStillReturnsResult() {
		var failure = new AiChatResponse();
		var request = new AiChatRequest();
		when(service.executeNonStreaming(same(request))).thenReturn(failure);
		assertSame(failure, controller.analyzeError(request));
		assertEquals("analyze-error", request.getMode());
	}
}
