package com.douzi.sqlive.dto.ai;

import lombok.Data;
import java.util.List;

@Data
public class SuggestResponse {
    private boolean success;
    private DataPayload data;

    @Data
    public static class DataPayload {
        private List<TopicInfo> currentTopics;
        private List<Suggestion> suggestions;

        @Data
        public static class TopicInfo {
            private String id;
            private String label;
            private double confidence;
        }

        @Data
        public static class Suggestion {
            private String id;
            private String label;
            private String reason;
            private int difficulty;
            private List<String> prerequisites;
        }
    }
}
