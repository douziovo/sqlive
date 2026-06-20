package com.douzi.sqlive.service.sql;

import org.springframework.stereotype.Component;
import java.util.ArrayList;
import java.util.List;

@Component
public class SqlParser {

    private static final String[] ERROR_POS_PREFIXES = {",", "),", "\n", ") "};
    private static final String[] TOKEN_PREFIXES =
            {"near \"", "near '", "token: \"", "token: '", "unrecognized token: \""};

    public record SqlStatement(String sql, int startLine, int startPos) {}

    public List<SqlStatement> parseStatementsPrecise(String script) {
        List<SqlStatement> list = new ArrayList<>();
        int len = script.length();
        int i = 0;
        int line = 1;

        while (i < len) {
            // 1. 跳过语句之间的空白和注释，并准确累加行号
            int prevI = i;
            i = skipWhitespaceAndComments(script, i);
            while (prevI < i) {
                if (script.charAt(prevI) == '\n') line++;
                prevI++;
            }
            if (i >= len) break;

            int startLine = line;
            int start = i;

            boolean inSingleQuote = false; // 判定 '字符串'
            boolean inDoubleQuote = false; // 判定 "标识符"（如列名、表名）
            int beginDepth = 0;
            int caseDepth = 0;

            // 2. 进入语句内部的动态扫描
            while (i < len) {
                char c = script.charAt(i);

                // 随时记录换行
                if (c == '\n') {
                    line++;
                }

                // 处理双引号标识符 (PostgreSQL 里的 "column_name")
                if (inDoubleQuote) {
                    if (c == '"') {
                        // 标准 SQL 转义：双双引号表示一个双引号 ""
                        if (i + 1 < len && script.charAt(i + 1) == '"') {
                            i++;
                        } else {
                            inDoubleQuote = false;
                        }
                    }
                    i++;
                    continue;
                }

                // 处理单引号字符串
                if (inSingleQuote) {
                    if (c == '\'') {
                        // 标准 SQL 转义：双单引号表示一个单引号 ''
                        if (i + 1 < len && script.charAt(i + 1) == '\'') {
                            i++;
                        } else {
                            inSingleQuote = false;
                        }
                    } else if (c == '\\' && i + 1 < len) {
                        // 兼容 PostgreSQL 允许的反斜杠转义（如 E'abc\'def'）
                        i++;
                    }
                    i++;
                    continue;
                }

                // 处理语句内部的【单行注释】
                if (c == '-' && i + 1 < len && script.charAt(i + 1) == '-') {
                    int nextLine = script.indexOf('\n', i);
                    if (nextLine == -1) {
                        i = len;
                    } else {
                        i = nextLine; // 让外层循环在相遇 '\n' 时正确累加行号
                    }
                    continue;
                }

                // 处理语句内部的【块注释】
                if (c == '/' && i + 1 < len && script.charAt(i + 1) == '*') {
                    int endComment = script.indexOf("*/", i);
                    int commentStart = i;
                    if (endComment == -1) {
                        i = len;
                    } else {
                        i = endComment + 2;
                    }
                    // 必须手动扫描并累加块注释内部包含的换行符
                    for (int j = commentStart; j < i; j++) {
                        if (script.charAt(j) == '\n') line++;
                    }
                    continue;
                }

                // 检测是否进入字符串或标识符
                if (c == '\'') {
                    inSingleQuote = true;
                    i++;
                    continue;
                }
                if (c == '"') {
                    inDoubleQuote = true;
                    i++;
                    continue;
                }

                // 严格的双向词边界关键字匹配
                if (isKeyword(script, i, start, "CASE")) {
                    caseDepth++;
                    i += 4;
                    continue;
                }
                if (isKeyword(script, i, start, "BEGIN")) {
                    beginDepth++;
                    i += 5;
                    continue;
                }
                if (isKeyword(script, i, start, "END")) {
                    if (caseDepth > 0) {
                        caseDepth--;
                    } else {
                        beginDepth = Math.max(0, beginDepth - 1);
                    }
                    i += 3;
                    continue;
                }

                // 语句切分终点：非字符串、非注释、深度为0的分号
                if (c == ';' && beginDepth == 0 && caseDepth == 0) {
                    i++; // 吃掉这个分号
                    break;
                }

                i++;
            }

            String sql = script.substring(start, i);
            if (!sql.trim().isEmpty()) {
                list.add(new SqlStatement(sql, startLine, start));
            }
        }
        return list;
    }

    public int locateErrorLine(String statementSql, int startLine, String errorMessage) {
        String token = extractToken(errorMessage);
        if (token == null || token.isEmpty()) return startLine;

        int pos = findErrorPos(statementSql, token);
        if (pos == -1) return startLine;

        if (token.equals(";") || token.equals(")") || token.equals("(")) {
            int before = pos;
            while (before > 0 && Character.isWhitespace(statementSql.charAt(before - 1))) {
                before--;
            }
            if (before > 0) {
                char preceding = statementSql.charAt(before - 1);
                if (preceding == ')') {
                    int closeParen = before - 1;
                    int prevCloseParen = statementSql.lastIndexOf(')', closeParen - 1);
                    if (prevCloseParen >= 0) {
                        String between = statementSql.substring(prevCloseParen + 1, closeParen);
                        pos = between.contains(",") ? closeParen : prevCloseParen;
                    } else {
                        pos = closeParen;
                    }
                } else {
                    pos = before - 1;
                }
            }
        }

        int offset = 0;
        for (int j = 0; j < pos; j++) {
            if (statementSql.charAt(j) == '\n') offset++;
        }
        return startLine + offset;
    }

    private boolean isKeyword(String script, int index, int statementStart, String keyword) {
        int kwLen = keyword.length();
        if (index + kwLen > script.length()) return false;

        // 1. 内容不匹配直接返回
        if (!script.regionMatches(true, index, keyword, 0, kwLen)) return false;

        // 2. 检查左侧词边界：如果前一个字符是单词组成部分，说明不是独立关键字
        if (index > statementStart && isWordChar(script.charAt(index - 1))) return false;

        // 3. 检查右侧词边界：如果后一个字符是单词组成部分，说明不是独立关键字
		return index + kwLen >= script.length() || !isWordChar(script.charAt(index + kwLen));
	}

    // 提取出来的公共简化判定
    private boolean isWordChar(char c) {
        return Character.isLetterOrDigit(c) || c == '_';
    }

    // 核心改进：由于数据库编译/解析错误是从前往后触发，
    // 寻找引发错误的 Token 应当使用标准的 indexOf（首次出现），而非 lastIndexOf
    private int findErrorPos(String sql, String token) {
        if (token.length() <= 2) {
            for (String prefix : ERROR_POS_PREFIXES) {
                int pos = sql.indexOf(prefix + token);
                if (pos != -1) return pos + prefix.length();
            }
        }
        return sql.indexOf(token);
    }

    private String extractToken(String msg) {
        for (String prefix : TOKEN_PREFIXES) {
            int idx = msg.indexOf(prefix);
            if (idx == -1) continue;
            char quote = prefix.charAt(prefix.length() - 1);
            int start = idx + prefix.length();
            int end = msg.indexOf(quote, start);
            if (end != -1) return msg.substring(start, end);
        }
        return null;
    }

    private int skipWhitespaceAndComments(String text, int index) {
        int len = text.length();
        while (index < len) {
            char c = text.charAt(index);
            if (Character.isWhitespace(c)) { index++; continue; }
            if (c == '-' && index + 1 < len && text.charAt(index + 1) == '-') {
                int nextLine = text.indexOf('\n', index);
                if (nextLine == -1) return len;
                index = nextLine + 1;
                continue;
            }
            if (c == '/' && index + 1 < len && text.charAt(index + 1) == '*') {
                int endComment = text.indexOf("*/", index);
                if (endComment == -1) return len;
                index = endComment + 2;
                continue;
            }
            break;
        }
        return index;
    }
}