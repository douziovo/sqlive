package com.douzi.sqlive.controller;

import com.douzi.sqlive.dto.ai.AiChatRequest;
import com.douzi.sqlive.dto.ai.AiChatResponse;
import com.douzi.sqlive.dto.ai.StreamChunk;
import com.douzi.sqlive.service.ai.AiService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@Tag(name = "AI", description = "AI 助手对话与代码生成")
@Slf4j
public class AiController {

	private final AiService aiService;

	/**
	 * General chat — streaming SSE.
	 */
	@PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
	@Operation(summary = "AI 对话", description = "流式 SSE 对话，支持非流式回退")
	public Flux<StreamChunk> chat(@Valid @RequestBody AiChatRequest request) {
		String chatId = UUID.randomUUID().toString().substring(0, 8);
		request.setMode("chat");
		log.info("[{}] Chat request, stream={}", chatId, request.isStream());

		if (!request.isStream()) {
			var resp = aiService.executeNonStreaming(request);
			return Flux.just(
					StreamChunk.text(resp.isSuccess() ? resp.getData().getContent() : resp.getError().getMessage()),
					StreamChunk.done()
			);
		}
		return aiService.streamChat(request)
				.concatWithValues(StreamChunk.done())
				.onErrorResume(e -> {
					log.error("[{}] Chat stream error", chatId, e);
					return Flux.just(StreamChunk.error("AI service error, please try again later"), StreamChunk.done());
				});
	}

	/**
	 * Error analysis
	 */
	@PostMapping("/analyze-error")
	@Operation(summary = "分析错误", description = "解释 SQL 错误原因并给出修复建议")
	public AiChatResponse analyzeError(@Valid @RequestBody AiChatRequest request) {
		String reqId = UUID.randomUUID().toString().substring(0, 8);
		request.setMode("analyze-error");
		log.info("[{}] Analyze-error request", reqId);
		return logAndReturn(reqId, request.getMode(), aiService.executeNonStreaming(request));
	}

	/**
	 * Code fix
	 */
	@PostMapping("/fix-code")
	@Operation(summary = "修复代码", description = "针对 SQL 错误生成修复后的代码")
	public AiChatResponse fixCode(@Valid @RequestBody AiChatRequest request) {
		String reqId = UUID.randomUUID().toString().substring(0, 8);
		request.setMode("fix-code");
		log.info("[{}] Fix-code request", reqId);
		return logAndReturn(reqId, request.getMode(), aiService.executeNonStreaming(request));
	}

	/**
	 * Explain selected SQL
	 */
	@PostMapping("/explain")
	@Operation(summary = "解释代码", description = "解释选中 SQL 的语义")
	public AiChatResponse explain(@Valid @RequestBody AiChatRequest request) {
		String reqId = UUID.randomUUID().toString().substring(0, 8);
		request.setMode("explain");
		log.info("[{}] Explain request", reqId);
		return logAndReturn(reqId, request.getMode(), aiService.executeNonStreaming(request));
	}

	/**
	 * Optimize selected SQL
	 */
	@PostMapping("/optimize")
	@Operation(summary = "优化 SQL", description = "对选中 SQL 提出优化建议")
	public AiChatResponse optimize(@Valid @RequestBody AiChatRequest request) {
		String reqId = UUID.randomUUID().toString().substring(0, 8);
		request.setMode("optimize");
		log.info("[{}] Optimize request", reqId);
		return logAndReturn(reqId, request.getMode(), aiService.executeNonStreaming(request));
	}

	private AiChatResponse logAndReturn(String reqId, String mode, AiChatResponse resp) {
		if (resp.isSuccess()) {
			int contentLen = resp.getData() != null && resp.getData().getContent() != null
					? resp.getData().getContent().length() : 0;
			log.info("[{}] {} success, responseLen={}", reqId, mode, contentLen);
		} else {
			log.warn("[{}] {} failed: {}", reqId, mode, resp.getError() != null ? resp.getError().getMessage() : "unknown");
		}
		return resp;
	}
}
