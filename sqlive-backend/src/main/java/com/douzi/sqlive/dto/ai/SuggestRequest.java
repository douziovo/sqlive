package com.douzi.sqlive.dto.ai;

import lombok.Data;
import java.util.List;

@Data
public class SuggestRequest {
    private String currentSql;
    private List<String> currentTopics;
    private List<String> masteredTopics;
}
