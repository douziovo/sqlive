package com.douzi.sqlive.dto.ai;

import com.douzi.sqlive.dto.ErrorPayload;
import lombok.Data;
import java.util.List;

@Data
@SuppressWarnings("unused")
public class AiChatResponse {
    private boolean success;
    private DataPayload data;
    private ErrorPayload error;

    @Data
    public static class DataPayload {
        private String content;
        private String fixedCode;
        private String summary;
        private List<ExplainStep> stepByStep;
        private List<String> tips;

        @Data
        public static class ExplainStep {
            private int step;
            private String what;
            private String why;
        }
    }

    public static AiChatResponse error(String message) {
        AiChatResponse response = new AiChatResponse();
        response.setSuccess(false);
        response.setError(new ErrorPayload(message, 0));
        return response;
    }
}
