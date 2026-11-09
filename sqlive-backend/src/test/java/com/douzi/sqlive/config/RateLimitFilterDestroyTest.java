package com.douzi.sqlive.config;

import com.douzi.sqlive.service.ratelimit.RequestRateLimiter;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

class RateLimitFilterDestroyTest {

	@Test
	void destroyReleasesTheLimiterWithoutWaitingForAnExecutor() {
		var limiter = mock(RequestRateLimiter.class);
		var filter = new RateLimitFilter(limiter);
		filter.destroy();
		verify(limiter).close();
	}

	@Test
	void destroyPreservesAnExistingInterruptAndCanBeRepeated() {
		var filter = new RateLimitFilter(new RequestRateLimiter(100, 100, 60_000));
		Thread.currentThread().interrupt();
		try {
			filter.destroy();
			filter.destroy();
			assertTrue(Thread.currentThread().isInterrupted());
		} finally {
			// 清除中断标志的同时断言它确实处于中断态，返回值不再被忽略
			assertTrue(Thread.interrupted());
		}
	}
}
