package com.douzi.sqlive.service.ai;

import java.util.regex.Pattern;

/**
 * Shared error-message redaction (/ SEC-02): strips the Authorization
 * header and the raw API key from provider error messages before they are
 * logged or returned to the client.
 */
final class ApiKeyRedactor {

	private static final Pattern BEARER_HEADER = Pattern.compile("(?i)Authorization:\\s*Bearer\\s+\\S+");

	private ApiKeyRedactor() {
	}

	/**
	 * Redacts Bearer headers and the given raw API key from the message.
	 * Returns null only if the input message is null. A null/blank apiKey
	 * (Ollama/LM Studio don't require one) is skipped — String.replace on a
	 * null key would throw and mask the original error.
	 */
	static String redact(String message, String apiKey) {
		if (message == null) return null;
		String sanitized = BEARER_HEADER.matcher(message).replaceAll("Authorization: Bearer [REDACTED]");
		if (apiKey != null && !apiKey.isBlank()) {
			sanitized = sanitized.replace(apiKey, "[REDACTED]");
		}
		return sanitized;
	}
}
