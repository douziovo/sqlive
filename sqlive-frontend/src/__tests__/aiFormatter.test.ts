import { describe, it, expect } from 'vitest';
import {
  formatErrorAnalysis,
  formatFixCode,
  formatExplain,
  formatOptimize,
  formatGenerateSql,
  extractSqlFromMarkdown,
} from '../utils/aiFormatter';

describe('formatErrorAnalysis', () => {
  it('formats full error analysis with all fields', () => {
    const result = formatErrorAnalysis({
      summary: 'Syntax error near SELECT',
      content: 'Missing comma between columns',
      fixedCode: 'SELECT id, name FROM users',
      tips: ['Use a linter', 'Check column names'],
    });
    expect(result).toContain('错误原因');
    expect(result).toContain('Syntax error near SELECT');
    expect(result).toContain('详细分析');
    expect(result).toContain('Missing comma between columns');
    expect(result).toContain('修复方案');
    expect(result).toContain('SELECT id, name FROM users');
    expect(result).toContain('如何避免');
    expect(result).toContain('Use a linter');
    expect(result).toContain('Check column names');
  });

  it('handles summary only', () => {
    const result = formatErrorAnalysis({ summary: 'Syntax error' });
    expect(result).toContain('Syntax error');
    expect(result).not.toContain('详细分析');
    expect(result).not.toContain('如何避免');
  });

  it('handles empty data', () => {
    const result = formatErrorAnalysis({});
    expect(result).toBe('');
  });

  it('handles undefined tips', () => {
    const result = formatErrorAnalysis({ summary: 'Error', content: 'Details', fixedCode: 'SELECT 1' });
    expect(result).toContain('Error');
    expect(result).not.toContain('如何避免');
  });

  it('handles fixedCode with SQL formatting', () => {
    const result = formatErrorAnalysis({ fixedCode: 'CREATE TABLE t (id INT);' });
    expect(result).toContain('```sql');
    expect(result).toContain('CREATE TABLE t (id INT);');
  });
});

describe('formatFixCode', () => {
  const originalCode = 'SELEKT 1;';

  it('formats with all fields', () => {
    const result = formatFixCode(
      { summary: 'Fixed typo', fixedCode: 'SELECT 1;', explanation: 'SELEKT should be SELECT' },
      { originalCode },
    );
    expect(result).toContain('修复方案');
    expect(result).toContain('Fixed typo');
    expect(result).toContain('原始代码');
    expect(result).toContain('SELEKT 1;');
    expect(result).toContain('修复后');
    expect(result).toContain('SELECT 1;');
    expect(result).toContain('SELEKT should be SELECT');
  });

  it('handles fixedCode only', () => {
    const result = formatFixCode({ fixedCode: 'SELECT 1;' }, { originalCode });
    expect(result).toContain('SELECT 1;');
    expect(result).toContain('SELEKT 1;');
  });

  it('includes original code in markdown block', () => {
    const result = formatFixCode({ fixedCode: 'SELECT 1;' }, { originalCode: 'SELECT *\nFROM t' });
    expect(result).toContain('```sql');
    expect(result).toContain('SELECT *');
    expect(result).toContain('FROM t');
  });
});

describe('formatExplain', () => {
  it('formats with step-by-step breakdown', () => {
    const result = formatExplain({
      summary: 'Simple SELECT',
      stepByStep: [
        { step: 1, what: 'SELECT', why: 'Selects columns' },
        { step: 2, what: 'FROM', why: 'Specifies table' },
      ],
      tips: ['Use aliases'],
    });
    expect(result).toContain('Simple SELECT');
    expect(result).toContain('逐句拆解');
    expect(result).toContain('1. SELECT');
    expect(result).toContain('Selects columns');
    expect(result).toContain('2. FROM');
    expect(result).toContain('Specifies table');
    expect(result).toContain('使用提示');
    expect(result).toContain('Use aliases');
  });

  it('formats with content field', () => {
    const result = formatExplain({ content: 'Additional details here' });
    expect(result).toContain('Additional details here');
  });

  it('handles summary only', () => {
    const result = formatExplain({ summary: 'Just a summary' });
    expect(result).toContain('Just a summary');
    expect(result).not.toContain('逐句拆解');
  });

  it('handles empty data', () => {
    const result = formatExplain({});
    expect(result).toBe('');
  });

  it('still formats content when stepByStep is empty array', () => {
    const result = formatExplain({ summary: 'S', stepByStep: [], tips: [] });
    expect(result).toContain('S');
    expect(result).not.toContain('0.');
  });
});

describe('formatOptimize', () => {
  const selectedCode = 'SELECT * FROM t';

  it('formats with optimizedCode', () => {
    const result = formatOptimize(
      {
        summary: 'Use index hint',
        optimizedCode: 'SELECT * FROM t WITH (INDEX(idx))',
        explanation: 'Using index improves performance',
      },
      { selectedCode },
    );
    expect(result).toContain('优化建议');
    expect(result).toContain('Use index hint');
    expect(result).toContain('原始代码');
    expect(result).toContain('SELECT * FROM t');
    expect(result).toContain('优化后');
    expect(result).toContain('SELECT * FROM t WITH (INDEX(idx))');
    expect(result).toContain('Using index improves performance');
  });

  it('falls back to fixedCode when optimizedCode is absent', () => {
    const result = formatOptimize({ fixedCode: 'SELECT * FROM t WHERE 1=1' }, { selectedCode });
    expect(result).toContain('SELECT * FROM t WHERE 1=1');
  });

  it('includes content field', () => {
    const result = formatOptimize({ content: 'Extra info', fixedCode: 'SELECT 1' }, { selectedCode });
    expect(result).toContain('Extra info');
    expect(result).toContain('SELECT 1');
  });

  it('handles summary only', () => {
    const result = formatOptimize({ summary: 'Small improvement' }, { selectedCode });
    expect(result).toContain('Small improvement');
    expect(result).not.toContain('原始代码');
  });

  it('handles empty data', () => {
    const result = formatOptimize({}, { selectedCode });
    expect(result).toBe('');
  });
});

describe('formatGenerateSql', () => {
  it('wraps result in SQL markdown code block', () => {
    const result = formatGenerateSql('CREATE TABLE t (id INT);');
    expect(result).toContain('生成的 SQL');
    expect(result).toContain('```sql');
    expect(result).toContain('CREATE TABLE t (id INT);');
  });

  it('handles empty string', () => {
    const result = formatGenerateSql('');
    expect(result).toContain('```sql');
    expect(result).toContain('```');
  });

  it('handles multi-line SQL', () => {
    const sql = 'CREATE TABLE t (\n  id INT,\n  name TEXT\n);';
    const result = formatGenerateSql(sql);
    expect(result).toContain('CREATE TABLE t (');
    expect(result).toContain('id INT');
    expect(result).toContain('name TEXT');
  });
});

describe('extractSqlFromMarkdown', () => {
  it('extracts SQL from ```sql block', () => {
    const text = 'Here is the SQL:\n```sql\nCREATE TABLE t(id INT);\n```\nEnjoy!';
    expect(extractSqlFromMarkdown(text)).toBe('CREATE TABLE t(id INT);');
  });

  it('extracts multi-line SQL', () => {
    const text = '```sql\nSELECT *\nFROM users\nWHERE id = 1\n```';
    expect(extractSqlFromMarkdown(text)).toBe('SELECT *\nFROM users\nWHERE id = 1');
  });

  it('returns undefined when no SQL code block', () => {
    expect(extractSqlFromMarkdown('Plain text')).toBeUndefined();
  });

  it('returns undefined on empty string', () => {
    expect(extractSqlFromMarkdown('')).toBeUndefined();
  });

  it('extracts first SQL block when multiple exist', () => {
    const text = '```sql\nSELECT 1;\n```\nSome text\n```sql\nSELECT 2;\n```';
    expect(extractSqlFromMarkdown(text)).toBe('SELECT 1;');
  });

  it('handles code blocks with language variant', () => {
    const text = '```sql\nSELECT 1;\n```';
    expect(extractSqlFromMarkdown(text)).toBe('SELECT 1;');
  });

  it('returns undefined for non-SQL code blocks', () => {
    const text = '```javascript\nconsole.log("hi");\n```';
    expect(extractSqlFromMarkdown(text)).toBeUndefined();
  });
});
