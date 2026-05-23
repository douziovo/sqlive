package com.douzi.sqlive.service.ai;

import reactor.core.publisher.Flux;
import com.douzi.sqlive.dto.ai.AiChatRequest;
import com.douzi.sqlive.dto.ai.StreamChunk;
import java.util.List;

public interface AiProvider {
    String getProviderName();
    boolean isAvailable();

    /** Non-streaming completion for analyze/fix/explain/optimize modes */
    String complete(String systemPrompt, String userMessage);

    /** Streaming chat for the chat panel */
    Flux<StreamChunk> streamChat(String systemPrompt, List<AiChatRequest.ChatMessage> history, String userMessage);
}
