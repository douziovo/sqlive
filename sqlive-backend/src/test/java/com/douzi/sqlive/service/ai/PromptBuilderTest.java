package com.douzi.sqlive.service.ai;

import com.douzi.sqlive.dto.ai.AiChatRequest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PromptBuilderTest {

    // ── helpers ──

    private static AiChatRequest basicRequest() {
        var req = new AiChatRequest();
        req.setCurrentSql("SELECT * FROM users;");
        return req;
    }

    private static AiChatRequest requestWithError() {
        var req = new AiChatRequest();
        req.setCurrentSql("SELECT * FROM users;");
        var err = new AiChatRequest.ErrorInfo();
        err.setMessage("near \"x\": syntax error");
        err.setLine(3);
        req.setError(err);
        return req;
    }

    private static AiChatRequest requestWithSchema() {
        var req = basicRequest();
        var col = new AiChatRequest.SchemaInfo();
        col.setTable("users");
        col.setColumns(List.of("id", "name", "email"));
        req.setSchema(List.of(col));
        return req;
    }

    // ── buildChatPrompt ──

    @Test
    void buildChatPromptShouldIncludeInstruction() {
        var prompt = PromptBuilder.buildChatPrompt(basicRequest());
        assertTrue(prompt.contains("SQL 教学助手"));
        assertTrue(prompt.contains("SQLite"));
        assertTrue(prompt.contains("markdown"));
    }

    @Test
    void buildChatPromptShouldIncludeCurrentSql() {
        var req = basicRequest();
        req.setCurrentSql("SELECT id FROM employees;");
        var prompt = PromptBuilder.buildChatPrompt(req);
        assertTrue(prompt.contains("SELECT id FROM employees;"));
        assertTrue(prompt.contains("```sql"));
    }

    @Test
    void buildChatPromptShouldExcludeSqlBlockWhenNull() {
        var req = basicRequest();
        req.setCurrentSql(null);
        var prompt = PromptBuilder.buildChatPrompt(req);
        assertFalse(prompt.contains("```sql"));
    }

    @Test
    void buildChatPromptShouldExcludeSqlBlockWhenBlank() {
        var req = basicRequest();
        req.setCurrentSql("   ");
        var prompt = PromptBuilder.buildChatPrompt(req);
        assertFalse(prompt.contains("```sql"));
    }

    @Test
    void buildChatPromptShouldIncludeSchema() {
        var prompt = PromptBuilder.buildChatPrompt(requestWithSchema());
        assertTrue(prompt.contains("users"));
        assertTrue(prompt.contains("id, name, email"));
    }

    @Test
    void buildChatPromptShouldOmitSchemaSectionWhenEmpty() {
        var req = basicRequest();
        req.setSchema(List.of());
        var prompt = PromptBuilder.buildChatPrompt(req);
        // The "## 数据库结构" heading is conditionally appended only when schema is non-empty
        assertEquals(0, req.getSchema().size());
        assertNotNull(prompt);
    }

    // ── buildErrorAnalysisPrompt ──

    @Test
    void buildErrorAnalysisPromptShouldIncludeErrorDetails() {
        var prompt = PromptBuilder.buildErrorAnalysisPrompt(requestWithError());
        assertTrue(prompt.contains("near \"x\": syntax error"));
        assertTrue(prompt.contains("第 3 行"));
    }

    @Test
    void buildErrorAnalysisPromptShouldIncludeCurrentSql() {
        var prompt = PromptBuilder.buildErrorAnalysisPrompt(requestWithError());
        assertTrue(prompt.contains("SELECT * FROM users;"));
    }

    @Test
    void buildErrorAnalysisPromptShouldRequestJsonOutput() {
        var prompt = PromptBuilder.buildErrorAnalysisPrompt(requestWithError());
        assertTrue(prompt.contains("JSON"));
        assertTrue(prompt.contains("fixedCode"));
        assertTrue(prompt.contains("summary"));
    }

    @Test
    void buildErrorAnalysisPromptShouldNotIncludeErrorSectionWhenNull() {
        var req = basicRequest();
        var prompt = PromptBuilder.buildErrorAnalysisPrompt(req);
        assertFalse(prompt.contains("## 错误信息"));
    }

    // ── buildFixCodePrompt ──

    @Test
    void buildFixCodePromptShouldIncludeErrorAndCode() {
        var prompt = PromptBuilder.buildFixCodePrompt(requestWithError());
        assertTrue(prompt.contains("near \"x\": syntax error"));
        assertTrue(prompt.contains("SELECT * FROM users;"));
        assertTrue(prompt.contains("fixedCode"));
    }

    @Test
    void buildFixCodePromptShouldNotFailWithoutError() {
        var prompt = PromptBuilder.buildFixCodePrompt(basicRequest());
        assertFalse(prompt.contains("错误："));
        assertTrue(prompt.contains("fixedCode"));
    }

    // ── buildExplainPrompt ──

    @Test
    void buildExplainPromptShouldIncludeSelectedCode() {
        var req = basicRequest();
        req.setSelectedCode("SELECT * FROM t WHERE x > 10");
        var prompt = PromptBuilder.buildExplainPrompt(req);
        assertTrue(prompt.contains("SELECT * FROM t WHERE x > 10"));
        assertTrue(prompt.contains("stepByStep"));
    }

    @Test
    void buildExplainPromptShouldNotIncludeSqlWhenSelectedCodeNull() {
        var req = basicRequest();
        req.setSelectedCode(null);
        var prompt = PromptBuilder.buildExplainPrompt(req);
        assertFalse(prompt.contains("```sql"));
    }

    // ── buildOptimizePrompt ──

    @Test
    void buildOptimizePromptShouldIncludeSelectedCode() {
        var req = basicRequest();
        req.setSelectedCode("SELECT * FROM huge_table");
        var prompt = PromptBuilder.buildOptimizePrompt(req);
        assertTrue(prompt.contains("SELECT * FROM huge_table"));
        assertTrue(prompt.contains("optimizedCode"));
        assertTrue(prompt.contains("性能优化"));
    }

    @Test
    void buildOptimizePromptShouldIncludeSchema() {
        var req = requestWithSchema();
        req.setSelectedCode("SELECT * FROM users");
        var prompt = PromptBuilder.buildOptimizePrompt(req);
        assertTrue(prompt.contains("users"));
        assertTrue(prompt.contains("id, name, email"));
    }

    // ── edge cases ──

    @Test
    void promptsShouldNotBeNull() {
        assertNotNull(PromptBuilder.buildChatPrompt(new AiChatRequest()));
        assertNotNull(PromptBuilder.buildErrorAnalysisPrompt(new AiChatRequest()));
        assertNotNull(PromptBuilder.buildFixCodePrompt(new AiChatRequest()));
        assertNotNull(PromptBuilder.buildExplainPrompt(new AiChatRequest()));
        assertNotNull(PromptBuilder.buildOptimizePrompt(new AiChatRequest()));
    }

    @Test
    void buildChatPromptShouldHandleChineseCharacters() {
        var req = basicRequest();
        req.setCurrentSql("-- 这是一个注释\nSELECT 姓名 FROM 用户表;");
        var prompt = PromptBuilder.buildChatPrompt(req);
        assertTrue(prompt.contains("姓名"));
        assertTrue(prompt.contains("用户表"));
    }

    @Test
    void promptsShouldNotContainNullLiteral() {
        var req = requestWithSchema();
        req.setSelectedCode("SELECT 1");
        for (var prompt : new String[] {
            PromptBuilder.buildChatPrompt(req),
            PromptBuilder.buildErrorAnalysisPrompt(req),
            PromptBuilder.buildFixCodePrompt(req),
            PromptBuilder.buildExplainPrompt(req),
            PromptBuilder.buildOptimizePrompt(req),
        }) {
            assertFalse(prompt.contains("null"));
        }
    }
}
