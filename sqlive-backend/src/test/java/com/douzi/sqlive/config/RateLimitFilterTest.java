package com.douzi.sqlive.config;

import jakarta.servlet.FilterChain;
import com.douzi.sqlive.service.ratelimit.RequestRateLimiter;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;


import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RateLimitFilterTest {
	@Test
	void zeroLimitRejectsTheFirstRequest() throws Exception {
		var filter = new RateLimitFilter(new RequestRateLimiter(100, 0, 60_000));
		FilterChain chain = mock(FilterChain.class);
		try {
			var request = new MockHttpServletRequest("POST", "/api/execute");
			var response = new MockHttpServletResponse();
			filter.doFilter(request, response, chain);
			assertEquals(429, response.getStatus());
			verifyNoInteractions(chain);
		} finally {
			filter.destroy();
		}
	}

	@Test
	void aiAndSqlRequestsHaveSeparateLimitsAndOtherPathsPassThrough() throws Exception {
		var filter = new RateLimitFilter(new RequestRateLimiter(1, 1, 60_000));
		FilterChain chain = mock(FilterChain.class);
		try {
			var ai = new MockHttpServletRequest("POST", "/api/ai/chat");
			ai.setRemoteAddr("198.51.100.1");
			filter.doFilter(ai, new MockHttpServletResponse(), chain);
			var aiRejected = new MockHttpServletResponse();
			filter.doFilter(ai, aiRejected, chain);
			assertEquals(429, aiRejected.getStatus());
			assertEquals("60", aiRejected.getHeader("Retry-After"));
			assertTrue(aiRejected.getContentAsString().contains("Too many requests"));

			var sql = new MockHttpServletRequest("POST", "/api/execute");
			sql.setRemoteAddr("198.51.100.1");
			filter.doFilter(sql, new MockHttpServletResponse(), chain);
			var sqlRejected = new MockHttpServletResponse();
			filter.doFilter(sql, sqlRejected, chain);
			assertEquals(429, sqlRejected.getStatus());

			filter.doFilter(new MockHttpServletRequest("GET", "/health"),
					new MockHttpServletResponse(), chain);
			verify(chain, times(3)).doFilter(any(), any());
		} finally {
			filter.destroy();
		}
	}

}
