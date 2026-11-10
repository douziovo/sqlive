package com.douzi.sqlive.service.ratelimit;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;

class RequestRateLimiterTest {

	@Test
	void isolatesClientsAndEndpoints() {
		try (var limiter = new RequestRateLimiter(1, 2, 60_000)) {
			assertTrue(limiter.tryAcquire("client-a", "/api/ai/chat").allowed());
			assertFalse(limiter.tryAcquire("client-a", "/api/ai/chat").allowed());
			assertTrue(limiter.tryAcquire("client-a", "/api/ai/explain").allowed());
			assertTrue(limiter.tryAcquire("client-b", "/api/ai/chat").allowed());
			assertTrue(limiter.tryAcquire("client-a", "/api/execute").allowed());
			assertTrue(limiter.tryAcquire("client-a", "/api/execute").allowed());
			assertFalse(limiter.tryAcquire("client-a", "/api/execute").allowed());
			assertTrue(limiter.tryAcquire("client-a", "/api/knowledge/graph").allowed());
		}
	}

	@Test
	void refillsAtTheWindowBoundaryWithoutEarlyQuotaFromRejectedRequests() {
		var clock = new AtomicLong();
		try (var limiter = new RequestRateLimiter(1, 1, Duration.ofMinutes(1), clock::get)) {
			assertTrue(limiter.tryAcquire("client", "/api/execute").allowed());
			assertEquals(60, limiter.tryAcquire("client", "/api/execute").retryAfterSeconds());
			clock.set(Duration.ofMillis(59_500).toNanos());
			var rejected = limiter.tryAcquire("client", "/api/execute");
			assertFalse(rejected.allowed());
			assertEquals(1, rejected.retryAfterSeconds(), "Retry-After rounds up fractional seconds");
			clock.set(Duration.ofMinutes(1).toNanos());
			assertTrue(limiter.tryAcquire("client", "/api/execute").allowed());
			assertFalse(limiter.tryAcquire("client", "/api/execute").allowed());
			clock.set(Duration.ofMinutes(3).toNanos());
			assertTrue(limiter.tryAcquire("client", "/api/execute").allowed(), "idle bucket can be recreated");
			assertFalse(limiter.tryAcquire("client", "/api/execute").allowed());
		}
	}

	@Test
	void concurrentRequestsCannotExceedTheQuota() throws Exception {
		try (var limiter = new RequestRateLimiter(10, 20, 60_000);
		     var executor = Executors.newFixedThreadPool(20)) {
			var start = new CountDownLatch(1);
			var calls = new ArrayList<Callable<Boolean>>();
			for (int i = 0; i < 100; i++) {
				calls.add(() -> {
					assertTrue(start.await(5, TimeUnit.SECONDS));
					return limiter.tryAcquire("shared-client", "/api/execute").allowed();
				});
			}
			start.countDown();
			int accepted = 0;
			for (var result : executor.invokeAll(calls)) {
				if (result.get()) accepted++;
			}
			assertEquals(20, accepted);
		}
	}

	@Test
	void nonPositiveLimitsRejectImmediatelyButUnrelatedPathsPass() {
		try (var limiter = new RequestRateLimiter(0, -1, 1500)) {
			assertFalse(limiter.tryAcquire("client", "/api/ai/chat").allowed());
			assertEquals(2, limiter.tryAcquire("client", "/api/execute").retryAfterSeconds());
			assertTrue(limiter.tryAcquire("client", "/health").allowed());
		}
	}

	@Test
	void invalidWindowFailsAtStartup() {
		// try-with-resources 在构造抛异常时不会创建资源，既表达资源归属又不触发资源泄漏警告
		assertThrows(IllegalArgumentException.class, () -> {
			try (var ignored = new RequestRateLimiter(1, 1, 0)) {
				fail("非法窗口参数应在构造阶段就被拒绝");
			}
		});
		// 同上：非法窗口参数也是在构造阶段抛出，不会留下待关闭的资源
		assertThrows(IllegalArgumentException.class, () -> {
			try (var ignored = new RequestRateLimiter(1, 1, -1)) {
				// 同上：构造成功即说明非法窗口未被拒绝，交由 assertThrows 判定失败
				fail("非法窗口参数应在构造阶段就被拒绝");
			}
		});
	}
}
