package com.douzi.sqlive.dto.ai;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class AiChatRequest {
	private String mode;          // chat | analyze-error | fix-code | explain | optimize
	@Size(max = 50000, message = "Message too large")
	private String message;       // user message (chat mode)
	@Size(max = 50, message = "Too many history messages")
	private List<ChatMessage> history;

	// context
	@Size(max = 100000, message = "SQL too large")
	private String currentSql;    // full SQL from editor
	@Size(max = 50000, message = "Selected code too large")
	private String selectedCode;  // selected SQL snippet
	private List<SchemaInfo> schema;
	private ErrorInfo error;

	private boolean stream = true;

	@Data
	public static class ChatMessage {
		private String role;      // user | assistant | system
		private String content;
	}

	@Data
	public static class SchemaInfo {
		private String table;
		private List<String> columns;
		private Map<String, String> columnTypes;
	}

	@Data
	public static class ErrorInfo {
		private String message;
		private int line;
	}
}
