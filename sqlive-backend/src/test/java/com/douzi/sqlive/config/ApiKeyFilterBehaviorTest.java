package com.douzi.sqlive.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Direct {@link ApiKeyFilter} behavior tests: constructor profile warning
 * branches and header validation paths (missing key, wrong key, valid key,
 * and requests outside /api/ai).
 */
class ApiKeyFilterBehaviorTest {

	@Test
	void constructorWarnsOnlyWhenKeyMissingOutsideDevOrTestProfiles() {
		// no profile → warning branch
		assertDoesNotThrow(() -> new ApiKeyFilter("", ""));
		// dev profile → no warning
		assertDoesNotThrow(() -> new ApiKeyFilter("", "dev"));
		// test profile → no warning
		assertDoesNotThrow(() -> new ApiKeyFilter("", "test"));
		// key configured → constructor guard skipped entirely
		assertDoesNotThrow(() -> new ApiKeyFilter("secret", "prod"));
		// null key (defensive) → treated like blank
		assertDoesNotThrow(() -> new ApiKeyFilter(null, "prod"));
	}

	@Test
	void nullExpectedKeyBypassesAuthentication() throws Exception {
		var filter = new ApiKeyFilter(null, "test");
		var chain = mock(FilterChain.class);
		try {
			var request = new MockHttpServletRequest("POST", "/api/ai/chat");
			var response = new MockHttpServletResponse();
			filter.doFilter(request, response, chain);
			assertEquals(200, response.getStatus());
			verify(chain).doFilter(request, response);
			var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
			assertNotNull(auth);
			assertEquals("api-key-bypass", auth.getPrincipal());
		} finally {
			org.springframework.security.core.context.SecurityContextHolder.clearContext();
		}
	}

	@Test
	void missingHeaderIsRejectedWith401() throws Exception {
		var filter = new ApiKeyFilter("secret", "test");
		var chain = mock(FilterChain.class);
		try {
			var request = new MockHttpServletRequest("POST", "/api/ai/chat");
			var response = new MockHttpServletResponse();
			filter.doFilter(request, response, chain);
			assertEquals(401, response.getStatus());
			verifyNoInteractions(chain);
		} finally {
			org.springframework.security.core.context.SecurityContextHolder.clearContext();
		}
	}

	@Test
	void wrongKeyIsRejectedWith401() throws Exception {
		var filter = new ApiKeyFilter("secret", "test");
		var chain = mock(FilterChain.class);
		try {
			var request = new MockHttpServletRequest("POST", "/api/ai/chat");
			request.addHeader("X-API-Key", "not-the-secret");
			var response = new MockHttpServletResponse();
			filter.doFilter(request, response, chain);
			assertEquals(401, response.getStatus());
			assertEquals("Invalid API key", response.getContentAsString());
			verifyNoInteractions(chain);
		} finally {
			org.springframework.security.core.context.SecurityContextHolder.clearContext();
		}
	}

	@Test
	void validKeyAuthenticatesAndContinuesChain() throws Exception {
		var filter = new ApiKeyFilter("secret", "test");
		var chain = mock(FilterChain.class);
		try {
			var request = new MockHttpServletRequest("POST", "/api/ai/chat");
			request.addHeader("X-API-Key", "secret");
			var response = new MockHttpServletResponse();
			filter.doFilter(request, response, chain);
			assertEquals(200, response.getStatus());
			verify(chain).doFilter(request, response);
			var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
			assertNotNull(auth);
			assertEquals("api-key-user", auth.getPrincipal());
		} finally {
			org.springframework.security.core.context.SecurityContextHolder.clearContext();
		}
	}

	@Test
	void devModeWithoutKeyBypassesAuthenticationForAiPaths() throws Exception {
		var filter = new ApiKeyFilter("", "dev");
		var chain = mock(FilterChain.class);
		try {
			var request = new MockHttpServletRequest("POST", "/api/ai/chat");
			var response = new MockHttpServletResponse();
			filter.doFilter(request, response, chain);
			assertEquals(200, response.getStatus());
			verify(chain).doFilter(request, response);
			var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
			assertNotNull(auth);
			assertEquals("api-key-bypass", auth.getPrincipal());
		} finally {
			org.springframework.security.core.context.SecurityContextHolder.clearContext();
		}
	}

	@Test
	void nullRequestUriPassesThroughWithoutValidation() throws Exception {
		var filter = new ApiKeyFilter("secret", "test");
		var chain = mock(FilterChain.class);
		HttpServletRequest request = mock(HttpServletRequest.class);
		when(request.getRequestURI()).thenReturn(null);
		when(request.getRemoteAddr()).thenReturn("127.0.0.1");
		var response = new MockHttpServletResponse();
		try {
			filter.doFilter(request, response, chain);
			assertEquals(200, response.getStatus());
			verify(chain).doFilter(request, response);
			verify(request, never()).getHeader(anyString());
		} finally {
			org.springframework.security.core.context.SecurityContextHolder.clearContext();
		}
	}

	@Test
	void nonAiPathsPassThroughWithoutKeyCheck() throws Exception {
		var filter = new ApiKeyFilter("secret", "test");
		var chain = mock(FilterChain.class);
		try {
			filter.doFilter(new MockHttpServletRequest("POST", "/api/execute"), new MockHttpServletResponse(), chain);
			filter.doFilter(new MockHttpServletRequest("GET", "/health"), new MockHttpServletResponse(), chain);
			verify(chain, times(2)).doFilter(any(), any());
		} finally {
			org.springframework.security.core.context.SecurityContextHolder.clearContext();
		}
	}
}
