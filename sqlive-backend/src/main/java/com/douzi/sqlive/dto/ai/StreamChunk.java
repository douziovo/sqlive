package com.douzi.sqlive.dto.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class StreamChunk {
	private String type;
	private String content;
	private Integer prompt;
	private Integer completion;
	private Integer total;

	public static StreamChunk text(String content) {
		StreamChunk c = new StreamChunk();
		c.type = "text";
		c.content = content;
		return c;
	}

	public static StreamChunk reasoning(String content) {
		StreamChunk c = new StreamChunk();
		c.type = "reasoning";
		c.content = content;
		return c;
	}

	public static StreamChunk usage(int prompt, int completion, int total) {
		StreamChunk c = new StreamChunk();
		c.type = "usage";
		c.prompt = prompt;
		c.completion = completion;
		c.total = total;
		return c;
	}

	public static StreamChunk done() {
		StreamChunk c = new StreamChunk();
		c.type = "done";
		return c;
	}

	public static StreamChunk error(String content) {
		StreamChunk c = new StreamChunk();
		c.type = "error";
		c.content = content;
		return c;
	}
}
