package com.douzi.sqlive.service.sql;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * SQL statement splitter for the playground's clear-and-re-execute model.
 *
 * <p>Offsets contract (must match frontend {@code code.value.substring(start, end)}):
 * <ul>
 *   <li>{@code endPos} = cursor position <b>after</b> the trailing semicolon (i.e. {@code i} after {@code i++; break;})</li>
 *   <li>All offsets are <b>UTF-16 code unit indices</b>, matching JS String.prototype.substring</li>
 *   <li>SQLite quotes escape by doubling the delimiter; backslashes are ordinary characters.
 *       Square-bracket identifiers close at the first {@code ]}.</li>
 * </ul>
 *
 * <p>Depth tracking: {@code beginDepth} (CREATE TRIGGER bodies only), {@code caseDepth} (CASE/END).
 * Transaction BEGIN/COMMIT/ROLLBACK/END remain separate executable statements.
 * {@code END} resolves to CASE first when {@code caseDepth > 0}.
 */
@Component
public class SqlParser {

	private static final String[] ERROR_POS_PREFIXES = {",", "),", "\n", ") "};
	private static final String[] TOKEN_PREFIXES =
			{"near \"", "near '", "token: \"", "token: '", "unrecognized token: \""};

	public List<SqlStatement> parseStatementsPrecise(String script) {
		List<SqlStatement> list = new ArrayList<>();
		int len = script.length();
		Scanner sc = new Scanner(script);

		while (sc.i < len) {
			// 1. 跳过语句之间的空白和注释，并准确累加行号
			int prevI = sc.i;
			sc.i = skipWhitespaceAndComments(script, sc.i);
			while (prevI < sc.i) {
				if (script.charAt(prevI) == '\n') sc.line++;
				prevI++;
			}
			if (sc.i >= len) break;

			int startLine = sc.line;
			int start = sc.i;
			sc.inSingleQuote = false;
			sc.inDoubleQuote = false;
			sc.identifierQuote = 0;
			sc.beginDepth = 0;
			sc.caseDepth = 0;
			sc.triggerStatement = isTriggerStatement(script, start);

			// 2. 进入语句内部的动态扫描
			scanStatementBody(sc, start);

			String sql = script.substring(start, sc.i);
			if (!sql.trim().isEmpty()) {
				list.add(new SqlStatement(sql, startLine, start, sc.i));
			}
		}
		return list;
	}

	// 语句内部的主扫描循环：分派给引号扫描、注释跳过、关键字深度跟踪等辅助方法
	private void scanStatementBody(Scanner sc, int statementStart) {
		String script = sc.script;
		int len = script.length();
		while (sc.i < len) {
			char c = script.charAt(sc.i);

			// 随时记录换行
			if (c == '\n') {
				sc.line++;
			}

			if (sc.inDoubleQuote) {
				scanDoubleQuotedIdentifier(sc);
				continue;
			}
			if (sc.inSingleQuote) {
				scanSingleQuotedString(sc);
				continue;
			}
			if (sc.identifierQuote != 0) {
				if (c == sc.identifierQuote) {
					if (c == '`' && sc.i + 1 < len && script.charAt(sc.i + 1) == '`') sc.i++;
					else sc.identifierQuote = 0;
				}
				sc.i++;
				continue;
			}
			if (isLineCommentStart(script, sc.i)) {
				skipLineComment(sc);
				continue;
			}
			if (isBlockCommentStart(script, sc.i)) {
				skipBlockComment(sc);
				continue;
			}
			if (c == '\'') {
				sc.inSingleQuote = true;
				sc.i++;
				continue;
			}
			if (c == '"') {
				sc.inDoubleQuote = true;
				sc.i++;
				continue;
			}
			if (c == '`' || c == '[') {
				sc.identifierQuote = c == '[' ? ']' : '`';
				sc.i++;
				continue;
			}
			if (advanceKeyword(sc, statementStart)) {
				continue;
			}
			// 语句切分终点：非字符串、非注释、深度为0的分号
			if (c == ';' && sc.beginDepth == 0 && sc.caseDepth == 0) {
				sc.i++; // 吃掉这个分号
				break;
			}
			sc.i++;
		}
	}

	// 处理 SQLite 双引号标识符
	private void scanDoubleQuotedIdentifier(Scanner sc) {
		String script = sc.script;
		if (script.charAt(sc.i) == '"') {
			// 标准 SQL 转义：双双引号表示一个双引号 ""
			if (sc.i + 1 < script.length() && script.charAt(sc.i + 1) == '"') {
				sc.i++;
			} else {
				sc.inDoubleQuote = false;
			}
		}
		sc.i++;
	}

	// 处理单引号字符串
	private void scanSingleQuotedString(Scanner sc) {
		String script = sc.script;
		char c = script.charAt(sc.i);
		if (c == '\'') {
			// 标准 SQL 转义：双单引号表示一个单引号 ''
			if (sc.i + 1 < script.length() && script.charAt(sc.i + 1) == '\'') {
				sc.i++;
			} else {
				sc.inSingleQuote = false;
			}
		}
		sc.i++;
	}

	// 处理语句内部的【单行注释】：停在 '\n' 上，让外层循环在相遇 '\n' 时正确累加行号
	private void skipLineComment(Scanner sc) {
		int nextLine = sc.script.indexOf('\n', sc.i);
		sc.i = nextLine == -1 ? sc.script.length() : nextLine;
	}

	// 处理语句内部的【块注释】：必须手动扫描并累加块注释内部包含的换行符
	private void skipBlockComment(Scanner sc) {
		String script = sc.script;
		int commentStart = sc.i;
		int endComment = script.indexOf("*/", sc.i);
		sc.i = endComment == -1 ? script.length() : endComment + 2;
		for (int j = commentStart; j < sc.i; j++) {
			if (script.charAt(j) == '\n') sc.line++;
		}
	}

	// 严格的双向词边界关键字匹配：跟踪 BEGIN/CASE 深度，END 优先闭合 CASE
	private boolean advanceKeyword(Scanner sc, int statementStart) {
		String script = sc.script;
		if (isKeyword(script, sc.i, statementStart, "CASE")) {
			sc.caseDepth++;
			sc.i += 4;
			return true;
		}
		if (isKeyword(script, sc.i, statementStart, "BEGIN")) {
			if (sc.triggerStatement) sc.beginDepth++;
			sc.i += 5;
			return true;
		}
		if (isKeyword(script, sc.i, statementStart, "END")) {
			// END ambiguity: prefer CASE/END closure (caseDepth > 0) over BEGIN/END closure.
			// Rationale: CASE always appears inside expression context; BEGIN is statement-level.
			if (sc.caseDepth > 0) {
				sc.caseDepth--;
			} else {
				sc.beginDepth = Math.max(0, sc.beginDepth - 1);
			}
			sc.i += 3;
			return true;
		}
		return false;
	}

	private boolean isTriggerStatement(String script, int start) {
		int cursor = skipWhitespaceAndComments(script, start);
		if (!isKeyword(script, cursor, start, "CREATE")) return false;
		cursor = skipWhitespaceAndComments(script, cursor + 6);
		if (isKeyword(script, cursor, start, "TEMPORARY")) {
			cursor = skipWhitespaceAndComments(script, cursor + 9);
		} else if (isKeyword(script, cursor, start, "TEMP")) {
			cursor = skipWhitespaceAndComments(script, cursor + 4);
		}
		return isKeyword(script, cursor, start, "TRIGGER");
	}

	private static boolean isLineCommentStart(String script, int i) {
		return script.charAt(i) == '-' && i + 1 < script.length() && script.charAt(i + 1) == '-';
	}

	private static boolean isBlockCommentStart(String script, int i) {
		return script.charAt(i) == '/' && i + 1 < script.length() && script.charAt(i + 1) == '*';
	}

	// 手写词法扫描器的可变状态：当前位置、行号、引号状态与 BEGIN/CASE 深度
	private static final class Scanner {
		final String script;
		int i;
		int line = 1;
		boolean inSingleQuote; // 判定 '字符串'
		boolean inDoubleQuote; // 判定 "标识符"（如列名、表名）
		char identifierQuote; // `identifier` or [identifier]
		int beginDepth;
		int caseDepth;
		boolean triggerStatement;

		Scanner(String script) {
			this.script = script;
		}
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
			if (Character.isWhitespace(c)) {
				index++;
				continue;
			}
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

	public record SqlStatement(String sql, int startLine, int startPos, int endPos) {
	}
}
