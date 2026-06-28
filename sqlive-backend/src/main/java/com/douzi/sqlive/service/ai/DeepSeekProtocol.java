package com.douzi.sqlive.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;

public class DeepSeekProtocol extends OpenAiProtocol {

	public DeepSeekProtocol(ObjectMapper objectMapper) {
		super(objectMapper);
	}

	@Override
	public boolean requiresApiKey() {
		return true;
	}

	@Override
	public Map<String, Object> buildRequest(RequestContext ctx) {
		Map<String, Object> body = super.buildRequest(ctx);
		body.put("thinking", Map.of("type", "enabled"));
		return body;
	}
}
