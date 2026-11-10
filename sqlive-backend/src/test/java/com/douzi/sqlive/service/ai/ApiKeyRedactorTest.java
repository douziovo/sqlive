package com.douzi.sqlive.service.ai;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ApiKeyRedactorTest {

	@Test
	void redactsBearerAuthorizationHeader() {
		var result = ApiKeyRedactor.redact(
				"Request failed: Authorization: Bearer sk-test-key-12345 status=401", null);
		assertEquals("Request failed: Authorization: Bearer [REDACTED] status=401", result);
	}

	@Test
	void redactsRawApiKeyAnywhereInMessage() {
		var result = ApiKeyRedactor.redact("upstream returned 401 for key=sk-raw-key-abc", "sk-raw-key-abc");
		assertEquals("upstream returned 401 for key=[REDACTED]", result);
	}

	@Test
	void redactsBothHeaderAndRawKey() {
		var result = ApiKeyRedactor.redact(
				"Authorization: bearer sk-both-key boom sk-both-key", "sk-both-key");
		assertEquals("Authorization: Bearer [REDACTED] boom [REDACTED]", result);
	}

	@Test
	void nullApiKeyIsSkippedWithoutThrowing() {
		assertEquals("plain error message", ApiKeyRedactor.redact("plain error message", null));
		assertNull(ApiKeyRedactor.redact(null, null));
	}

	@Test
	void blankApiKeyIsSkipped() {
		assertEquals("plain error message", ApiKeyRedactor.redact("plain error message", "  "));
	}
}
