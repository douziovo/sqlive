package com.douzi.sqlive.controller;

import com.douzi.sqlive.dto.ai.AiChatRequest;
import com.douzi.sqlive.dto.ai.AiChatResponse;
import com.douzi.sqlive.dto.ai.StreamChunk;
import com.douzi.sqlive.service.ai.AiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("unused")
public class AiController {

    private final AiService aiService;

    /** General chat — streaming SSE. */
    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
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

    /** Error analysis */
    @PostMapping("/analyze-error")
    public AiChatResponse analyzeError(@Valid @RequestBody AiChatRequest request) {
        String reqId = UUID.randomUUID().toString().substring(0, 8);
        request.setMode("analyze-error");
        log.info("[{}] Analyze-error request", reqId);
        return logAndReturn(reqId, request.getMode(), aiService.executeNonStreaming(request));
    }

    /** Code fix */
    @PostMapping("/fix-code")
    public AiChatResponse fixCode(@Valid @RequestBody AiChatRequest request) {
        String reqId = UUID.randomUUID().toString().substring(0, 8);
        request.setMode("fix-code");
        log.info("[{}] Fix-code request", reqId);
        return logAndReturn(reqId, request.getMode(), aiService.executeNonStreaming(request));
    }

    /** Explain selected SQL */
    @PostMapping("/explain")
    public AiChatResponse explain(@Valid @RequestBody AiChatRequest request) {
        String reqId = UUID.randomUUID().toString().substring(0, 8);
        request.setMode("explain");
        log.info("[{}] Explain request", reqId);
        return logAndReturn(reqId, request.getMode(), aiService.executeNonStreaming(request));
    }

    /** Optimize selected SQL */
    @PostMapping("/optimize")
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
