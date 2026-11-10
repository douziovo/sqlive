package com.douzi.sqlive.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Web-layer tuning knobs under the {@code sqlive.*} namespace (see application.yml).
 * Field defaults mirror the values previously hardcoded in WebConfig/RateLimitFilter.
 */
@Data
@Component
@ConfigurationProperties(prefix = "sqlive")
public class SqliveProperties {

	private final Cors cors = new Cors();
	private final RateLimit rateLimit = new RateLimit();

	@Data
	public static class Cors {
		private List<String> allowedOriginPatterns = List.of(
				"http://localhost:*", "http://127.0.0.1:*", "http://[::1]:*");
	}

	@Data
	public static class RateLimit {
		private int aiPerMinute = 100;
		private int sqlPerMinute = 500;
		private long windowMs = 60_000;
	}
}
