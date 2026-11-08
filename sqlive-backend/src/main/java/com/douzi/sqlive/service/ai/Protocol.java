package com.douzi.sqlive.service.ai;

import com.douzi.sqlive.dto.ai.StreamChunk;
import reactor.core.publisher.Flux;

import java.util.Map;

public interface Protocol {
	int LOG_CHUNK_MAX_LEN = 200;

	Map<String, Object> buildRequest(RequestContext ctx);

	String extractContent(String responseJson);

	static String abbreviateForLog(String chunk) {
		return chunk.length() <= LOG_CHUNK_MAX_LEN ? chunk
				: chunk.substring(0, LOG_CHUNK_MAX_LEN) + "...(truncated)";
	}

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
