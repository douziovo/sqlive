package com.douzi.sqlive.service.ratelimit;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Scheduler;
import com.github.benmanes.caffeine.cache.Ticker;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.TimeMeter;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

/** Per-client, per-endpoint interval refill. Bucket4j owns atomic quota consumption. */
public class RequestRateLimiter implements AutoCloseable {

	private final int aiLimit;
	private final int sqlLimit;
	private final Duration window;
	private final TimeMeter timeMeter;
	private final Cache<ClientEndpoint, Bucket> buckets;

	public RequestRateLimiter(int aiLimit, int sqlLimit, long windowMs) {
		this(aiLimit, sqlLimit, Duration.ofMillis(windowMs), Ticker.systemTicker());
	}

	RequestRateLimiter(int aiLimit, int sqlLimit, Duration window, Ticker ticker) {
		if (window.isNegative() || window.isZero()) {
			throw new IllegalArgumentException("Rate-limit window must be positive");
		}
		this.aiLimit = aiLimit;
		this.sqlLimit = sqlLimit;
		this.window = window;
		this.timeMeter = new TimeMeter() {
			@Override
			public long currentTimeNanos() {
				return ticker.read();
			}

			@Override
			public boolean isWallClockBased() {
				return false;
			}
		};
		// An idle bucket is full after one window, so replacing it cannot grant extra quota.
		// Size eviction would reset a live client's quota, so only expired windows are evicted.
		this.buckets = Caffeine.newBuilder()
				.expireAfterAccess(window)
				.ticker(ticker)
				.scheduler(Scheduler.systemScheduler())
				.build();
	}

	public Decision tryAcquire(String clientIp, String path) {
		int limit;
		if (path.startsWith("/api/ai/")) {
			limit = aiLimit;
		} else if (path.equals("/api/execute")) {
			limit = sqlLimit;
		} else {
			return new Decision(true, 0);
		}
		if (limit <= 0) return new Decision(false, secondsRoundedUp(window.toNanos()));

		Bucket bucket = buckets.get(new ClientEndpoint(clientIp, path), ignored -> Bucket.builder()
				.withCustomTimePrecision(timeMeter)
				.addLimit(bandwidth -> bandwidth.capacity(limit).refillIntervally(limit, window))
				.build());
		var probe = bucket.tryConsumeAndReturnRemaining(1);
		return new Decision(probe.isConsumed(), probe.isConsumed() ? 0
				: secondsRoundedUp(probe.getNanosToWaitForRefill()));
	}

	private static long secondsRoundedUp(long nanos) {
		return Math.max(1, TimeUnit.NANOSECONDS.toSeconds(nanos)
				+ (nanos % TimeUnit.SECONDS.toNanos(1) == 0 ? 0 : 1));
	}

	@Override
	public void close() {
		buckets.invalidateAll();
		buckets.cleanUp();
	}

	private record ClientEndpoint(String clientIp, String path) {
	}

	public record Decision(boolean allowed, long retryAfterSeconds) {
	}
}
