package com.douzi.sqlive.service.ai;

import com.douzi.sqlive.dto.ai.AiChatRequest;
import com.douzi.sqlive.dto.ai.AiProviderConfig;
import com.douzi.sqlive.dto.ai.StreamChunk;
import com.douzi.sqlive.exception.AiProviderException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
public class OpenAiCompatibleProvider implements AiProvider {

    private final AiProviderConfig config;
    private final WebClient webClient;
    private final String providerName;
    private final Protocol protocol;
    private final String endpoint;

    // Full constructor — package-private for test injection
    OpenAiCompatibleProvider(AiProviderConfig config,
                             WebClient webClient, Protocol protocol,
                             String providerName, String endpoint) {
        this.config = config;
        this.webClient = webClient;
        this.protocol = protocol;
        this.providerName = providerName;
        this.endpoint = endpoint;
    }

    // Production constructor
    public OpenAiCompatibleProvider(AiProviderConfig config,
                                    Protocol protocol, String providerName, String endpoint) {
        this(config, buildWebClient(config), protocol, providerName, endpoint);
    }

    public static OpenAiCompatibleProvider create(String name, AiProviderConfig cfg, ObjectMapper mapper) {
        Protocol proto = switch (name) {
            case "deepseek" -> new DeepSeekProtocol(mapper);
            case "ollama" -> new OllamaProtocol(mapper);
            case "lmstudio" -> new LmStudioProtocol(mapper);
            default -> new OpenAiProtocol(mapper);
        };
        String ep = switch (name) {
            case "ollama" -> "/api/chat";
            case "lmstudio" -> "/api/v1/chat";
            default -> "/chat/completions";
        };
        return new OpenAiCompatibleProvider(cfg, proto, name, ep);
    }

    private static WebClient buildWebClient(AiProviderConfig config) {
        var builder = WebClient.builder()
                .baseUrl(config.getBaseUrl())
                .defaultHeader("Content-Type", "application/json");
        if (config.hasApiKey()) {
            builder.defaultHeader("Authorization", "Bearer " + config.getApiKey());
        }
        return builder.build();
    }

    @Override
    public String getProviderName() {
        return providerName;
    }

    @Override
    public boolean isAvailable() {
        if (protocol.requiresApiKey()) {
            return config.getApiKey() != null && !config.getApiKey().isBlank();
        }
        return config.getBaseUrl() != null && !config.getBaseUrl().isBlank();
    }

    @Override
    public String complete(String systemPrompt, String userMessage) {
        log.debug("{} complete: model={}, baseUrl={}", providerName, config.getModel(), config.getBaseUrl());
        long start = System.currentTimeMillis();
        try {
            List<Map<String, String>> messages = new ArrayList<>();
            messages.add(Map.of("role", "system", "content", systemPrompt));
            messages.add(Map.of("role", "user", "content", userMessage));

            RequestContext ctx = new RequestContext(config.getModel(), messages,
                    config.getMaxTokens(), config.getTemperature(),
                    config.getReasoningEffort(), config.getMaxContextTokens(), false);
            Map<String, Object> body = protocol.buildRequest(ctx);

            String response = webClient.post()
                    .uri(endpoint)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            long elapsed = System.currentTimeMillis() - start;
            String result = protocol.extractContent(response);
            log.info("{} complete success: model={}, responseLen={}, elapsed={}ms",
                    providerName, config.getModel(), result.length(), elapsed);
            return result;
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("{} API call failed: model={}, elapsed={}ms", providerName, config.getModel(), elapsed, e);
            throw new AiProviderException("AI service call failed: " + e.getMessage());
        }
    }

    @Override
    public Flux<StreamChunk> streamChat(String systemPrompt, List<AiChatRequest.ChatMessage> history, String userMessage) {
        log.debug("{} streamChat: model={}, baseUrl={}", providerName, config.getModel(), config.getBaseUrl());
        List<Map<String, String>> messages = buildMessages(systemPrompt, history, userMessage);

        RequestContext ctx = new RequestContext(config.getModel(), messages,
                config.getMaxTokens(), config.getTemperature(),
                config.getReasoningEffort(), config.getMaxContextTokens(), true);
        Map<String, Object> body = protocol.buildRequest(ctx);

        return webClient.post()
                .uri(endpoint)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(body)
                .retrieve()
                .bodyToFlux(String.class)
                .transform(protocol::processStream);
    }

    private List<Map<String, String>> buildMessages(String systemPrompt,
                                                     List<AiChatRequest.ChatMessage> history,
                                                     String userMessage) {
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));
        if (history != null) {
            for (var msg : history) {
                messages.add(Map.of("role", msg.getRole(), "content", msg.getContent()));
            }
        }
        messages.add(Map.of("role", "user", "content", userMessage));
        return messages;
    }
}
