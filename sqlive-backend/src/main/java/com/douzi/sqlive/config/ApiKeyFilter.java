package com.douzi.sqlive.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * Validates the {@code X-API-Key} header against the configured {@code AI_API_KEY}.
 *
 * <p>Authorization filter for {@code /api/ai/**} endpoints — prevents anonymous abuse of
 * the DeepSeek quota when deployed. Non-AI endpoints (e.g. {@code /api/execute}) are
 * left public by {@link SecurityConfig} so the SQL playground semantics are preserved.
 *
 * <p>Behavior:
 * <ul>
 *   <li>{@code AI_API_KEY} blank/missing (dev mode) → request is permitted with a
 *       bypass authentication principal. Production deployments MUST set
 *       {@code AI_API_KEY} to prevent {@code /api/ai/**} from being silently public.</li>
 *   <li>{@code AI_API_KEY} set + valid {@code X-API-Key} header → request permitted
 *       with authenticated principal {@code "api-key-user"}.</li>
 *   <li>{@code AI_API_KEY} set + missing/invalid header → 401 Unauthorized.</li>
 * </ul>
 *
 * <p>Key comparison uses {@link MessageDigest#isEqual(byte[], byte[])} for constant-time
 * comparison to mitigate timing attacks against the configured key (T-13-03b).
 */
@Component
public class ApiKeyFilter extends OncePerRequestFilter {

	private static final String API_KEY_HEADER = "X-API-Key";
	private static final String AI_PATH_PREFIX = "/api/ai/";

	private final String expectedKey;

	public ApiKeyFilter(@Value("${AI_API_KEY:}") String apiKey) {
		this.expectedKey = apiKey;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		// Only enforce X-API-Key on AI endpoints; non-AI endpoints (/api/execute,
		// /api/knowledge/*, etc.) are intentionally public per playground semantics.
		String path = request.getRequestURI();
		if (path == null || !path.startsWith(AI_PATH_PREFIX)) {
			chain.doFilter(request, response);
			return;
		}

		// Dev bypass: no AI_API_KEY configured → permit without enforcing X-API-Key.
		// Set a dummy Authentication so SecurityConfig's `.authenticated()` passes.
		if (expectedKey == null || expectedKey.isBlank()) {
			SecurityContextHolder.getContext().setAuthentication(
					new UsernamePasswordAuthenticationToken("api-key-bypass", null, List.of()));
			chain.doFilter(request, response);
			return;
		}

		String provided = request.getHeader(API_KEY_HEADER);
		if (provided == null || !MessageDigest.isEqual(
				provided.getBytes(StandardCharsets.UTF_8),
				expectedKey.getBytes(StandardCharsets.UTF_8))) {
			response.setStatus(401);
			response.setContentType("text/plain;charset=UTF-8");
			response.getWriter().write("Invalid API key");
			return;
		}

		SecurityContextHolder.getContext().setAuthentication(
				new UsernamePasswordAuthenticationToken("api-key-user", null, List.of()));
		chain.doFilter(request, response);
	}
}
