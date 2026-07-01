package com.douzi.sqlive.exception;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Verifies the SPA fallback handler in {@link GlobalExceptionHandler} (D-10):
 * <ul>
 *   <li>HTML requests to non-API paths forward to {@code /index.html} so vue-router
 *       can resolve deep links on browser refresh.</li>
 *   <li>API paths ({@code /api/**}) return 404 JSON — not HTML — so frontend
 *       fetch/axios can parse error bodies.</li>
 *   <li>{@code /v3/api-docs} is whitelisted so springdoc serves JSON directly
 *       (Pitfall 5).</li>
 * </ul>
 *
 * <p>W2 fix: assertions strengthened — Test 1 checks the response body contains
 * the SPA root marker {@code <div id="app">} (verifies the forward actually
 * reached the index.html stub, not a default 404 error page); Test 2 checks the
 * 404 body contains a {@code status} or {@code error} JSON field (verifies a
 * real JSON error response, not just "non-HTML").
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SpaFallbackTest {

	private final RestTemplate restTemplate = new RestTemplate();

	@Value("${local.server.port}")
	private int port;

	private String url(String path) {
		return "http://localhost:" + port + path;
	}

	private HttpHeaders htmlHeaders() {
		HttpHeaders headers = new HttpHeaders();
		headers.setAccept(List.of(MediaType.TEXT_HTML));
		return headers;
	}

	private HttpHeaders jsonHeaders() {
		HttpHeaders headers = new HttpHeaders();
		headers.setAccept(List.of(MediaType.APPLICATION_JSON));
		return headers;
	}

	/**
	 * Spring Boot 4's default NoResourceFoundException handler returns
	 * {@code application/problem+json} (RFC 7807 ProblemDetail), not plain
	 * {@code application/json}. Treat both as JSON for the purpose of verifying
	 * the SPA fallback whitelist excludes API paths. {@code MediaType.isCompatibleWith}
	 * does not consider {@code application/problem+json} compatible with
	 * {@code application/json} in Spring Framework 7, so we check the subtype suffix.
	 */
	private static boolean isJsonContentType(MediaType ct) {
		return ct != null && (ct.getSubtype().equals("json") || ct.getSubtype().endsWith("+json"));
	}

	private static void assertJsonContentType(MediaType ct, String message) {
		assertNotNull(ct, message);
		assertTrue(isJsonContentType(ct), message + " — got " + ct);
	}

	@Test
	void shouldForwardDocsPathToIndexHtml() {
		HttpEntity<Void> entity = new HttpEntity<>(htmlHeaders());
		ResponseEntity<String> resp = restTemplate.exchange(
				url("/docs/usage/editor"), HttpMethod.GET, entity, String.class);

		assertEquals(HttpStatus.OK, resp.getStatusCode(),
				"SPA deep-link refresh should forward to /index.html and return 200");
		MediaType contentType = resp.getHeaders().getContentType();
		assertNotNull(contentType, "Content-Type header must be present");
		assertTrue(contentType.isCompatibleWith(MediaType.TEXT_HTML),
				"forwarded response should be text/html, got " + contentType);
		String body = resp.getBody();
		assertNotNull(body, "Response body must not be null");
		assertTrue(body.contains("<div id=\"app\">"),
				"Response body should contain SPA root marker <div id=\"app\">, got: " + body);
	}

	@Test
	void shouldReturn404JsonForApiPath() {
		try {
			restTemplate.exchange(
					url("/api/nonexistent"), HttpMethod.GET,
					new HttpEntity<>(jsonHeaders()), String.class);
			fail("Expected HttpClientErrorException for /api/nonexistent");
		} catch (HttpClientErrorException e) {
			assertEquals(HttpStatus.NOT_FOUND, e.getStatusCode(),
					"/api/nonexistent should return 404, got " + e.getStatusCode());
			MediaType contentType = e.getResponseHeaders() == null ? null : e.getResponseHeaders().getContentType();
			assertJsonContentType(contentType,
					"/api/** 404 should return JSON, not HTML — whitelist must exclude /api/**");
			String body = e.getResponseBodyAsString();
			assertNotNull(body, "404 body must not be null");
			assertTrue(body.contains("\"status\"") || body.contains("\"error\""),
					"404 body should contain a JSON status or error field, got: " + body);
		}
	}

	@Test
	void shouldNotInterceptApiDocsPath() {
		HttpEntity<Void> entity = new HttpEntity<>(jsonHeaders());
		ResponseEntity<String> resp = restTemplate.exchange(
				url("/v3/api-docs"), HttpMethod.GET, entity, String.class);

		MediaType contentType = resp.getHeaders().getContentType();
		assertJsonContentType(contentType,
				"/v3/api-docs should return JSON (whitelist excludes /v3/api-docs from SPA forward)");
	}
}
