package com.douzi.sqlive.config;

import com.douzi.sqlive.dto.SqlRequest;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.NonNull;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.web.client.DefaultResponseErrorHandler;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Runs in its own Spring context with a lowered SQL rate limit — the filter
 * reads limits from application.yml at construction time, so the threshold
 * can no longer be changed mid-test via system properties.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = "sqlive.rate-limit.sql-per-minute=20")
@Slf4j
class RateLimitFilterOverloadConcurrencyTest {

	private final RestTemplate restTemplate = new RestTemplate();
	@Value("${local.server.port}")
	private int port;

	{
		restTemplate.setErrorHandler(new DefaultResponseErrorHandler() {
			@Override
			protected boolean hasError(@NonNull HttpStatusCode statusCode) {
				return false;
			}
		});
	}

	@Test
	void shouldEnforceRateLimitUnderConcurrentOverload() throws Exception {
		int sqlLimit = 20;
		int threadCount = 100;
		String url = "http://localhost:" + port + "/api/execute";
		CountDownLatch latch = new CountDownLatch(threadCount);
		AtomicInteger successCount = new AtomicInteger(0);
		AtomicInteger rejectCount = new AtomicInteger(0);
		List<Exception> errors = Collections.synchronizedList(new ArrayList<>());

		SqlRequest req = new SqlRequest();
		req.setSql("SELECT 1;");
		req.setDbName("rlf_over");
		req.setReset(true);
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);

		try (ExecutorService executor = Executors.newFixedThreadPool(50)) {
			for (int i = 0; i < threadCount; i++) {
				executor.submit(() -> {
					try {
						HttpEntity<SqlRequest> entity = new HttpEntity<>(req, headers);
						ResponseEntity<String> resp =
								restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
						if (resp.getStatusCode().value() == 429) {
							rejectCount.incrementAndGet();
						} else if (resp.getStatusCode().value() == 200) {
							successCount.incrementAndGet();
						}
					} catch (Exception e) {
						errors.add(e);
					} finally {
						latch.countDown();
					}
				});
			}
			assertTrue(latch.await(30, TimeUnit.SECONDS));
			if (!errors.isEmpty()) {
				log.warn("{} network errors during rate-limit test: {}", errors.size(), errors.getFirst().getMessage());
			}
			assertTrue(successCount.get() <= sqlLimit,
					"At most " + sqlLimit + " should pass, got: " + successCount.get());
			assertTrue(rejectCount.get() > 0,
					"Some requests should be rejected, got success="
							+ successCount.get() + " rejected=" + rejectCount.get());
		}
	}
}
