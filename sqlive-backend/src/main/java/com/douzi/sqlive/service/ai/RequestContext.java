package com.douzi.sqlive.service.ai;

import java.util.List;
import java.util.Map;

public record RequestContext(
		String model,
		List<Map<String, String>> messages,
		int maxTokens,
		double temperature,
		String reasoningEffort,
		int maxContextTokens,
		boolean stream) {
}
