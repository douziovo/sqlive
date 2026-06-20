package com.douzi.sqlive.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Slf4j
public class RateLimitFilter implements Filter {

    private static final long WINDOW_MS = 60_000;

    private final Map<String, long[]> aiCounters = new ConcurrentHashMap<>();
    private final Map<String, long[]> sqlCounters = new ConcurrentHashMap<>();

    private final ScheduledExecutorService cleanupScheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "ratelimit-cleanup");
        t.setDaemon(true);
        return t;
    });

    private volatile boolean cleanupStarted = false;

    private static int aiRateLimit() {
        return Integer.getInteger("rate.limit.ai", 100);
    }

    private static int sqlRateLimit() {
        return Integer.getInteger("rate.limit.sql", 500);
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse resp = (HttpServletResponse) response;
        String path = req.getRequestURI();
        String clientIp = req.getRemoteAddr();

        if (!cleanupStarted) {
            synchronized (this) {
                if (!cleanupStarted) {
                    cleanupScheduler.scheduleAtFixedRate(this::cleanupExpiredEntries, 5, 5, TimeUnit.MINUTES);
                    cleanupStarted = true;
                }
            }
        }

        int limit;
        Map<String, long[]> counters;
        if (path.startsWith("/api/ai/")) {
            limit = aiRateLimit();
            counters = aiCounters;
        } else if (path.equals("/api/execute")) {
            limit = sqlRateLimit();
            counters = sqlCounters;
        } else {
            chain.doFilter(request, response);
            return;
        }

        String key = clientIp + ":" + path;
        long now = System.currentTimeMillis();
        long[] window = counters.computeIfAbsent(key, k -> new long[]{now, 0});

        synchronized (window) {
            if (now - window[0] > WINDOW_MS) {
                counters.remove(key, window);
                window[0] = now;
                window[1] = 1;
            } else if (window[1] >= limit) {
                log.warn("Rate limit exceeded: ip={}, path={}, count={}", clientIp, path, window[1]);
                resp.setStatus(429);
                resp.setContentType("application/json;charset=UTF-8");
                resp.getWriter().write("{\"success\":false,\"error\":{\"message\":\"Too many requests, please slow down\"}}");
                return;
            } else {
                window[1]++;
            }
        }

        chain.doFilter(request, response);
    }

    private void cleanupExpiredEntries() {
        long now = System.currentTimeMillis();
        cleanupMap(aiCounters, now);
        cleanupMap(sqlCounters, now);
    }

    @Override
    public void destroy() {
        cleanupScheduler.shutdown();
        try {
            if (!cleanupScheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                cleanupScheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            cleanupScheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    private void cleanupMap(Map<String, long[]> counters, long now) {
        counters.entrySet().removeIf(entry -> {
            long[] window = entry.getValue();
            synchronized (window) {
                return now - window[0] > WINDOW_MS;
            }
        });
    }
}
