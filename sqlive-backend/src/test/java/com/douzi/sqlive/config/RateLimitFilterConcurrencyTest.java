package com.douzi.sqlive.config;

import com.douzi.sqlive.dto.SqlRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.lang.Nullable;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.web.client.DefaultResponseErrorHandler;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import lombok.extern.slf4j.Slf4j;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@Slf4j
class RateLimitFilterConcurrencyTest {

    @Value("${local.server.port}")
    private int port;

    private final RestTemplate restTemplate = new RestTemplate();
    {
        restTemplate.setErrorHandler(new DefaultResponseErrorHandler() {
            @Override
            protected boolean hasError(@Nullable HttpStatusCode statusCode) {
                return false;
            }
        });
    }

    @Test
    void shouldAllowConcurrentRequestsUnderRateLimit() throws Exception {
        int threadCount = 5;
        String url = "http://localhost:" + port + "/api/execute";
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);
        List<Throwable> errors = Collections.synchronizedList(new ArrayList<>());

        SqlRequest req = new SqlRequest();
        req.setSql("SELECT 1;");
        req.setDbName("rlf_under");
        req.setReset(true);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        try (ExecutorService executor = Executors.newFixedThreadPool(threadCount)) {
            for (int i = 0; i < threadCount; i++) {
                executor.submit(() -> {
                    try {
                        HttpEntity<SqlRequest> entity = new HttpEntity<>(req, headers);
                        ResponseEntity<String> resp =
                            restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
                        if (resp.getStatusCode().value() == 200) {
                            successCount.incrementAndGet();
                        }
                    } catch (Exception e) {
                        errors.add(e);
                    } finally {
                        latch.countDown();
                    }
                });
            }
            assertTrue(latch.await(15, TimeUnit.SECONDS));
            assertTrue(errors.isEmpty(), "No errors: " + errors);
            assertEquals(threadCount, successCount.get(),
                "All " + threadCount + " requests under limit should pass");
        }
    }

    @Test
    void shouldEnforceRateLimitUnderConcurrentOverload() throws Exception {
        int sqlLimit = 20;
        System.setProperty("rate.limit.sql", String.valueOf(sqlLimit));
        try {
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
                    log.warn("{} network errors during rate-limit test: {}", errors.size(), errors.get(0).getMessage());
                }
                assertTrue(successCount.get() <= sqlLimit,
                    "At most " + sqlLimit + " should pass, got: " + successCount.get());
                assertTrue(rejectCount.get() > 0,
                    "Some requests should be rejected, got success="
                    + successCount.get() + " rejected=" + rejectCount.get());
            }
        } finally {
            System.clearProperty("rate.limit.sql");
        }
    }

    @Test
    void shouldNotThrowExceptionsUnderConcurrentLoad() throws Exception {
        int threadCount = 20;
        String url = "http://localhost:" + port + "/api/execute";
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger errorCount = new AtomicInteger(0);
        AtomicInteger successCount = new AtomicInteger(0);

        SqlRequest req = new SqlRequest();
        req.setSql("SELECT 1;");
        req.setDbName("rlf_noerr");
        req.setReset(true);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        try (ExecutorService executor = Executors.newFixedThreadPool(10)) {
            for (int i = 0; i < threadCount; i++) {
                executor.submit(() -> {
                    try {
                        HttpEntity<SqlRequest> entity = new HttpEntity<>(req, headers);
                        ResponseEntity<String> resp =
                            restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
                        if (resp.getStatusCode().value() == 200) {
                            successCount.incrementAndGet();
                        }
                    } catch (Exception e) {
                        errorCount.incrementAndGet();
                    } finally {
                        latch.countDown();
                    }
                });
            }
            assertTrue(latch.await(15, TimeUnit.SECONDS));
            assertEquals(0, errorCount.get(),
                "No network/connection errors under concurrent load");
            assertTrue(successCount.get() > 0,
                "At least some requests should succeed under concurrent load");
        }
    }
}
