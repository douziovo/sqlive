package com.douzi.sqlive.dto.ai;

import lombok.Data;

@Data
public class AiProviderConfig {
    private String baseUrl;
    private String apiKey;
    private String model;
    private int maxTokens = 2048;
    private double temperature = 0.3;
    /**
     * LM Studio / reasoning models: "low", "medium", "high", or null to disable.
     * When set, adds {"reasoning": {"effort": "..."}} to the request body.
     */
    private String reasoningEffort;
    /** Context window size in tokens. Ollama: options.num_ctx */
    private int maxContextTokens;

    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank() && !"not-required".equals(apiKey);
    }
}
