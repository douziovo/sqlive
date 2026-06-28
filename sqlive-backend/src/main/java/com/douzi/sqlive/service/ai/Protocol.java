package com.douzi.sqlive.service.ai;

import com.douzi.sqlive.dto.ai.StreamChunk;
import reactor.core.publisher.Flux;

import java.util.Map;

public interface Protocol {
	Map<String, Object> buildRequest(RequestContext ctx);

	String extractContent(String responseJson);

	default boolean requiresApiKey() {
		return false;
	}

	default Flux<StreamChunk> processStream(Flux<String> rawLines) {
		return rawLines
				.map(String::trim)
				.filter(line -> !line.isEmpty() && !"[DONE]".equals(line))
				.map(this::unwrapSseData)
				.concatMap(this::parseChunk);
	}

	default Flux<StreamChunk> parseChunk(String jsonStr) {
		return Flux.empty();
	}

	private String unwrapSseData(String line) {
		return line.startsWith("data:") ? line.substring(5).trim() : line;
	}
}
