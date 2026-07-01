package com.douzi.sqlive.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI metadata for springdoc 3.x (D-11).
 *
 * <p>springdoc auto-scans {@code @RestController} classes for {@code @Tag} and
 * {@code @Operation} annotations and generates the {@code /v3/api-docs} OpenAPI
 * JSON. This {@code @Bean} only supplies document metadata (title, version,
 * description) — it does not modify endpoint discovery or the default
 * {@code /v3/api-docs} path (D-11: application.yml is NOT modified).
 */
@Configuration
public class OpenApiConfig {

	@Bean
	public OpenAPI sqliveOpenAPI() {
		return new OpenAPI()
				.info(new Info()
						.title("sqlive API")
						.version("1.0")
						.description("SQL playground 后端 API"));
	}
}
