package com.douzi.sqlive.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Health", description = "健康检查")
public class HealthController {

	@GetMapping("/health")
	@Operation(summary = "健康检查", description = "返回服务存活状态")
	@SuppressWarnings("SameReturnValue")
	public String health() {
		return "OK";
	}
}
