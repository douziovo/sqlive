package com.douzi.sqlive.config;

import tools.jackson.databind.ObjectMapper;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

	private final SqliveProperties sqliveProperties;

	public WebConfig(SqliveProperties sqliveProperties) {
		this.sqliveProperties = sqliveProperties;
	}

	@Override
	@SuppressWarnings("HttpUrlsUsage")
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/api/**")
				.allowedOriginPatterns(sqliveProperties.getCors().getAllowedOriginPatterns().toArray(String[]::new))
				.allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
				// include X-API-Key so the frontend can send it (wiring) and
				// the browser CORS preflight accepts it. Without this, cross-origin requests
				// (Vite dev :5173 → backend :8080) would be rejected at preflight even if
				// the frontend set the header.
				.allowedHeaders("Content-Type", "Authorization", "Accept", "X-API-Key")
				.allowCredentials(false);
	}

	@Bean
	public FilterRegistrationBean<RateLimitFilter> rateLimitFilter() {
		var limits = sqliveProperties.getRateLimit();
		FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>();
		registration.setFilter(new RateLimitFilter(limits.getAiPerMinute(), limits.getSqlPerMinute(), limits.getWindowMs()));
		registration.addUrlPatterns("/api/*");
		registration.setOrder(1);
		return registration;
	}

	@Bean
	public ObjectMapper objectMapper() {
		return new ObjectMapper();
	}
}
