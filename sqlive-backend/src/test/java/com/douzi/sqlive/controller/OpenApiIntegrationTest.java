package com.douzi.sqlive.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Verifies springdoc 3.x auto-generates {@code /v3/api-docs} OpenAPI JSON
 * with the 4 controller tags (SQL/AI/Knowledge/Health, per D-11) and the
 * {@code /api/execute} path.
 *
 * <p>Depends on Task 1 (springdoc 3.x dependency + OpenApiConfig) and Task 2
 * (@Tag/@Operation annotations on the 4 controllers) being complete.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class OpenApiIntegrationTest {

	private final RestTemplate restTemplate = new RestTemplate();

	@Value("${local.server.port}")
	private int port;

	private String url(String path) {
		return "http://localhost:" + port + path;
	}

	@Test
	void shouldExposeOpenApiJson() {
		ResponseEntity<String> resp = restTemplate.exchange(
				url("/v3/api-docs"), HttpMethod.GET, HttpEntity.EMPTY, String.class);

		assertEquals(HttpStatus.OK, resp.getStatusCode(),
				"/v3/api-docs should return 200");
		MediaType contentType = resp.getHeaders().getContentType();
		assertNotNull(contentType, "Content-Type header must be present");
		assertTrue(contentType.isCompatibleWith(MediaType.APPLICATION_JSON),
				"/v3/api-docs should return application/json, got " + contentType);

		String body = resp.getBody();
		assertNotNull(body, "OpenAPI JSON body must not be null");
		assertTrue(body.contains("SQL"), "OpenAPI should contain SQL tag");
		assertTrue(body.contains("AI"), "OpenAPI should contain AI tag");
		assertTrue(body.contains("Knowledge"), "OpenAPI should contain Knowledge tag");
		assertTrue(body.contains("Health"), "OpenAPI should contain Health tag");
		assertTrue(body.contains("/api/execute"),
				"OpenAPI should contain /api/execute path");
	}
}
