package com.douzi.sqlive.config;

import com.douzi.sqlive.service.ratelimit.RequestRateLimiter;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;

@Slf4j
public class RateLimitFilter implements Filter {

	private final RequestRateLimiter rateLimiter;

	public RateLimitFilter(RequestRateLimiter rateLimiter) {
		this.rateLimiter = rateLimiter;
	}

	@Override
	public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
			throws IOException, ServletException {
		HttpServletRequest req = (HttpServletRequest) request;
		var decision = rateLimiter.tryAcquire(req.getRemoteAddr(), req.getRequestURI());
		if (!decision.allowed()) {
			log.warn("Rate limit exceeded: ip={}, path={}", req.getRemoteAddr(), req.getRequestURI());
			HttpServletResponse resp = (HttpServletResponse) response;
			resp.setStatus(429);
			resp.setHeader("Retry-After", Long.toString(decision.retryAfterSeconds()));
			resp.setContentType("application/json;charset=UTF-8");
			resp.getWriter().write("{\"success\":false,\"error\":{\"message\":\"Too many requests, please slow down\"}}");
			return;
		}
		chain.doFilter(request, response);
	}

	@Override
	public void destroy() {
		rateLimiter.close();
	}
}
