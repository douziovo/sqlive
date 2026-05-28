package com.douzi.sqlive.service.ai;

import com.douzi.sqlive.dto.ai.AiChatRequest;

/**
 * Builds system prompts for each AI mode.
 */
class PromptBuilder {

    static String buildChatPrompt(AiChatRequest req) {
        var sb = new StringBuilder();
        sb.append("你是一个 SQL 教学助手，帮助用户学习和调试 SQL 查询。用户使用 SQLite。\n");
        sb.append("你的回答应该：\n");
        sb.append("1. 有教育意义：解释概念，而不只是给答案\n");
        sb.append("2. 上下文相关：引用用户当前的代码和数据库结构\n");
        sb.append("3. 用中文回答\n");
        sb.append("4.输出严格使用markdown格式");

        if (req.getCurrentSql() != null && !req.getCurrentSql().isBlank()) {
            sb.append("## 用户当前的 SQL 代码\n```sql\n").append(req.getCurrentSql()).append("\n```\n\n");
        }
        appendSchema(sb, req, "## 数据库结构\n");
        return sb.toString();
    }

    static String buildErrorAnalysisPrompt(AiChatRequest req) {
        var sb = new StringBuilder();
        sb.append("你是一个 SQL 错误分析专家（SQLite）。请仔细分析以下错误。\n\n");

        if (req.getError() != null) {
            sb.append("## 错误信息\n");
            sb.append(req.getError().getMessage());
            sb.append("（第 ").append(req.getError().getLine()).append(" 行）\n\n");
        }
        if (req.getCurrentSql() != null && !req.getCurrentSql().isBlank()) {
            sb.append("## 完整 SQL 代码\n```sql\n").append(req.getCurrentSql()).append("\n```\n\n");
        }
        appendSchema(sb, req, "## 数据库结构（供参考）\n");
        sb.append("\n请返回 JSON 格式（不要带 markdown 代码块标记）：\n");
        sb.append("{\"summary\":\"一句话概括错误原因\",\"detail\":\"详细分析（用 markdown）\",\"fixedCode\":\"修正后的完整 SQL 语句\",\"prevention\":\"如何避免此错误\"}");
        return sb.toString();
    }

    static String buildFixCodePrompt(AiChatRequest req) {
        var sb = new StringBuilder();
        sb.append("你是 SQL 专家。修正以下 SQL 代码中的错误，输出正确的 SQL。\n\n");

        if (req.getError() != null) {
            sb.append("错误：").append(req.getError().getMessage()).append("\n\n");
        }
        if (req.getCurrentSql() != null && !req.getCurrentSql().isBlank()) {
            sb.append("原始代码：\n```sql\n").append(req.getCurrentSql()).append("\n```\n\n");
        }
        sb.append("返回 JSON（不要带 markdown 代码块标记）：\n");
        sb.append("{\"fixedCode\":\"修正后的完整 SQL\",\"explanation\":\"一句话说明改了什么\"}");
        return sb.toString();
    }

    static String buildExplainPrompt(AiChatRequest req) {
        var sb = new StringBuilder();
        sb.append("你是 SQL 教师。用中文解释以下 SQL 代码，面向初学者。\n\n");

        if (req.getSelectedCode() != null && !req.getSelectedCode().isBlank()) {
            sb.append("```sql\n").append(req.getSelectedCode()).append("\n```\n\n");
        }
        appendSchema(sb, req, "数据库结构：\n");
        sb.append("\n返回 JSON（不要带 markdown 代码块标记）：\n");
        sb.append("{\"summary\":\"一句话概述这段 SQL 做了什么\",\"stepByStep\":[{\"step\":1,\"what\":\"这部分做了什么\",\"why\":\"为什么要这样做\"}],\"tips\":[\"使用提示1\",\"使用提示2\"]}");
        return sb.toString();
    }

    static String buildOptimizePrompt(AiChatRequest req) {
        var sb = new StringBuilder();
        sb.append("你是 SQL 性能优化专家。分析以下 SQL 并给出优化建议。\n\n");

        if (req.getSelectedCode() != null && !req.getSelectedCode().isBlank()) {
            sb.append("```sql\n").append(req.getSelectedCode()).append("\n```\n\n");
        }
        appendSchema(sb, req, "数据库结构：\n");
        sb.append("\n返回 JSON（不要带 markdown 代码块标记）：\n");
        sb.append("{\"summary\":\"一句话概述优化点\",\"optimizedCode\":\"优化后的完整 SQL\",\"explanation\":\"每个改动的说明\"}");
        return sb.toString();
    }

    private static void appendSchema(StringBuilder sb, AiChatRequest req, String heading) {
        if (req.getSchema() != null && !req.getSchema().isEmpty()) {
            sb.append(heading);
            for (var t : req.getSchema()) {
                sb.append("- ").append(t.getTable()).append(" (");
                sb.append(String.join(", ", t.getColumns()));
                sb.append(")\n");
            }
        }
    }
}
