package com.douzi.sqlive.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RateLimitFilterTest {
	@Test
	void zeroLimitRejectsTheFirstRequest() throws Exception {
		System.setProperty("rate.limit.sql", "0");
		var filter = new RateLimitFilter();
		FilterChain chain = mock(FilterChain.class);
		try {
			var request = new MockHttpServletRequest("POST", "/api/execute");
			var response = new MockHttpServletResponse();
			filter.doFilter(request, response, chain);
			assertEquals(429, response.getStatus());
			verifyNoInteractions(chain);
		} finally {
			filter.destroy();
			System.clearProperty("rate.limit.sql");
		}
	}

	@Test
	void aiAndSqlRequestsHaveSeparateLimitsAndOtherPathsPassThrough() throws Exception {
		System.setProperty("rate.limit.ai", "1");
		System.setProperty("rate.limit.sql", "1");
		var filter = new RateLimitFilter();
		FilterChain chain = mock(FilterChain.class);
		try {
			var ai = new MockHttpServletRequest("POST", "/api/ai/chat");
			ai.setRemoteAddr("198.51.100.1");
			filter.doFilter(ai, new MockHttpServletResponse(), chain);
			var aiRejected = new MockHttpServletResponse();
			filter.doFilter(ai, aiRejected, chain);
			assertEquals(429, aiRejected.getStatus());
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
			System.clearProperty("rate.limit.ai");
			System.clearProperty("rate.limit.sql");
		}
	}

	@Test
	@SuppressWarnings("unchecked")
	void cleanupRemovesExpiredAiAndSqlWindowsButKeepsActiveWindow() throws Exception {
		var filter = new RateLimitFilter();
		FilterChain chain = mock(FilterChain.class);
		try {
			var ai = new MockHttpServletRequest("POST", "/api/ai/chat");
			ai.setRemoteAddr("198.51.100.2");
			var sql = new MockHttpServletRequest("POST", "/api/execute");
			sql.setRemoteAddr("198.51.100.2");
			filter.doFilter(ai, new MockHttpServletResponse(), chain);
			filter.doFilter(sql, new MockHttpServletResponse(), chain);
			var activeAi = new MockHttpServletRequest("POST", "/api/ai/chat");
			activeAi.setRemoteAddr("198.51.100.3");
			filter.doFilter(activeAi, new MockHttpServletResponse(), chain);

			Map<String, long[]> aiCounters = (Map<String, long[]>) ReflectionTestUtils.getField(filter, "aiCounters");
			Map<String, long[]> sqlCounters = (Map<String, long[]>) ReflectionTestUtils.getField(filter, "sqlCounters");
			assertNotNull(aiCounters);
			assertNotNull(sqlCounters);
			long expired = System.currentTimeMillis() - 61_000;
			aiCounters.get("198.51.100.2:/api/ai/chat")[0] = expired;
			sqlCounters.get("198.51.100.2:/api/execute")[0] = expired;
			ReflectionTestUtils.invokeMethod(filter, "cleanupExpiredEntries");

			assertFalse(aiCounters.containsKey("198.51.100.2:/api/ai/chat"));
			assertFalse(sqlCounters.containsKey("198.51.100.2:/api/execute"));
			assertTrue(aiCounters.containsKey("198.51.100.3:/api/ai/chat"));
		} finally {
			filter.destroy();
		}
	}

	@Test
	@SuppressWarnings("unchecked")
	void expiredWindowMustCountTheFirstNewRequest() throws Exception {
		System.setProperty("rate.limit.sql", "1");
		var filter = new RateLimitFilter();
		FilterChain chain = mock(FilterChain.class);
		try {
			var request = new MockHttpServletRequest("POST", "/api/execute");
			request.setRemoteAddr("198.51.100.4");
			filter.doFilter(request, new MockHttpServletResponse(), chain);
			Map<String, long[]> counters = (Map<String, long[]>) ReflectionTestUtils.getField(filter, "sqlCounters");
			assertNotNull(counters);
			counters.get("198.51.100.4:/api/execute")[0] = System.currentTimeMillis() - 61_000;

			var firstInNewWindow = new MockHttpServletResponse();
			filter.doFilter(request, firstInNewWindow, chain);
			assertEquals(200, firstInNewWindow.getStatus());
			var overLimit = new MockHttpServletResponse();
			filter.doFilter(request, overLimit, chain);
			assertEquals(429, overLimit.getStatus(), "the first request after expiry must consume the new quota");
			verify(chain, times(2)).doFilter(any(), any());
		} finally {
			filter.destroy();
			System.clearProperty("rate.limit.sql");
		}
	}
}
