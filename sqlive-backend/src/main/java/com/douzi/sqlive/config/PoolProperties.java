package com.douzi.sqlive.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Data
@Component
@ConfigurationProperties(prefix = "pool")
public class PoolProperties {
	private int maxDatabases = 200;
	private Duration idleTimeout = Duration.ofMinutes(5);
	private Duration cleanupInterval = Duration.ofMinutes(5);
}
