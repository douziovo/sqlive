package com.douzi.sqlive.config;

import jakarta.servlet.DispatcherType;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Spring Security authorization for AI endpoints (D-R0-005 option A).
 *
 * <p>{@code /api/ai/**} requires authentication (enforced by {@link ApiKeyFilter} via
 * the {@code X-API-Key} header). All other endpoints ({@code /api/execute},
 * {@code /api/knowledge/*}, etc.) remain public ({@code permitAll}) so the SQL
 * playground semantics are not broken.
 *
 * <p>CSRF is disabled because the backend is an API-only service consumed via
 * {@code X-API-Key} / JSON requests — no browser form submissions to protect.
 *
 * <p>ASYNC dispatches are permitted without re-authorization so that SSE streaming
 * on {@code /api/ai/chat} (which uses servlet async dispatch after the initial
 * REQUEST returns) completes cleanly. The initial REQUEST dispatch still enforces
 * {@code authenticated()} for {@code /api/ai/**}. Without this exemption, Spring
 * Security's {@code AuthorizationFilter} re-runs on the ASYNC dispatch with a
 * cleared SecurityContext and truncates the SSE response.
 *
 * <p>{@link ApiKeyFilter} is a {@code @Component} so Spring can inject the
 * {@code AI_API_KEY}-derived expected key via {@code @Value}. Its servlet-container
 * auto-registration is disabled via {@link #apiKeyFilterRegistration} so the filter
 * runs exclusively inside the {@link SecurityFilterChain} (preserves Spring Security's
 * async dispatch handling and avoids double-processing).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

	@Bean
	SecurityFilterChain filterChain(HttpSecurity http, ApiKeyFilter apiKeyFilter) throws Exception {
		return http
				.authorizeHttpRequests(auth -> auth
						// SSE streaming uses servlet ASYNC dispatch — permit without
						// re-checking auth (the initial REQUEST already enforced it).
						.dispatcherTypeMatchers(DispatcherType.ASYNC).permitAll()
						.dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
						.requestMatchers("/api/ai/**").authenticated()
						.anyRequest().permitAll())
				.addFilterBefore(apiKeyFilter, UsernamePasswordAuthenticationFilter.class)
				.csrf(csrf -> csrf.disable())
				.build();
	}

	/**
	 * Disables Spring Boot's auto-registration of {@link ApiKeyFilter} as a plain
	 * servlet filter. The filter is registered only inside the
	 * {@link SecurityFilterChain} via {@link #filterChain} so it doesn't interfere
	 * with Spring Security's async dispatch handling (SSE streaming).
	 */
	@Bean
	FilterRegistrationBean<ApiKeyFilter> apiKeyFilterRegistration(ApiKeyFilter apiKeyFilter) {
		FilterRegistrationBean<ApiKeyFilter> registration = new FilterRegistrationBean<>(apiKeyFilter);
		registration.setEnabled(false);
		return registration;
	}
}


