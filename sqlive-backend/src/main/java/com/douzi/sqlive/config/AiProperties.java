package com.douzi.sqlive.config;

import com.douzi.sqlive.dto.ai.AiProviderConfig;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;

@Data
@Component
@ConfigurationProperties(prefix = "ai")
public class AiProperties {
	private String provider = "deepseek";
	private Map<String, AiProviderConfig> providers = Map.of();
	private TimeoutConfig timeout = new TimeoutConfig();

	@Data
	public static class TimeoutConfig {
		private Duration connect = Duration.ofSeconds(5);
		private Duration read = Duration.ofSeconds(60);
		private Duration write = Duration.ofSeconds(30);
	}
}
