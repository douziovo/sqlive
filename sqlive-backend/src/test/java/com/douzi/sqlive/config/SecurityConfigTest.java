package com.douzi.sqlive.config;

import com.douzi.sqlive.dto.ai.AiChatResponse;
import com.douzi.sqlive.dto.ai.StreamChunk;
import com.douzi.sqlive.service.ai.AiService;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultMatcher;
import reactor.core.publisher.Flux;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies {@link SecurityConfig} + {@link ApiKeyFilter} authorization behavior:
 * <ul>
 *   <li>{@code /api/execute} is public (permitAll) — non-401 without X-API-Key.</li>
 *   <li>{@code /api/ai/chat} without X-API-Key returns 401 when AI_API_KEY is set.</li>
 *   <li>{@code /api/ai/chat} with valid X-API-Key does not return 401.</li>
 *   <li>{@code /api/ai/chat} bypasses authz (non-401) when AI_API_KEY is empty (dev mode).</li>
 * </ul>
 *
 * <p>{@link AiService} is mocked so the tests don't trigger real DeepSeek HTTP calls.
 */
@SpringBootTest(properties = "AI_API_KEY=test-key")
@AutoConfigureMockMvc
class SecurityConfigTest {

	@Autowired
	private MockMvc mockMvc;

	/** Asserts the response status is anything other than 401 Unauthorized. */
	private static ResultMatcher notUnauthorized() {
		return result -> assertNotEquals(401, result.getResponse().getStatus(),
				"Expected status != 401 but got " + result.getResponse().getStatus());
	}

	@Test
	void executeShouldBePublicAndNotRequireApiKey() throws Exception {
		// /api/execute is permitAll; empty body triggers @Valid @NotBlank → 400, but NOT 401
		mockMvc.perform(post("/api/execute")
						.contentType("application/json")
						.content("{}"))
				.andExpect(notUnauthorized());
	}

	@Test
	void aiChatWithoutApiKeyShouldReturn401() throws Exception {
		mockMvc.perform(post("/api/ai/chat")
						.contentType("application/json")
						.content("{}"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void aiChatWithValidApiKeyShouldNotReturn401() throws Exception {
		// Valid X-API-Key → ApiKeyFilter sets Authentication → request reaches AiController.
		// AiService is mocked; response is 200 SSE (not 401).
		mockMvc.perform(post("/api/ai/chat")
						.header("X-API-Key", "test-key")
						.contentType("application/json")
						.content("{}"))
				.andExpect(notUnauthorized());
	}

	/**
	 * Dev-mode bypass: when AI_API_KEY is empty, /api/ai/** must NOT return 401
	 * (ApiKeyFilter bypasses authz so local development doesn't require a key).
	 */
	@Nested
	@TestPropertySource(properties = "AI_API_KEY=")
	class WhenApiKeyNotConfigured {

		@Autowired
		private MockMvc mockMvc;

		@Test
		void aiChatShouldBypassWhenApiKeyNotConfigured() throws Exception {
			mockMvc.perform(post("/api/ai/chat")
							.contentType("application/json")
							.content("{}"))
					.andExpect(notUnauthorized());
		}
	}

	@TestConfiguration
	static class MockAiServiceConfig {

		@Bean
		@Primary
		AiService mockAiService() {
			var mockService = mock(AiService.class);
			when(mockService.streamChat(any())).thenReturn(Flux.just(StreamChunk.done()));
			when(mockService.executeNonStreaming(any())).thenReturn(new AiChatResponse());
			return mockService;
		}
	}
}
