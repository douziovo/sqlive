import { parsePrimaryType } from './sql';

/**
 * Utility functions for SQL statement parsing, type enforcement, and value comparison.
 * These are pure functions with no side effects or external dependencies.
 */

export const extractSqlStatements = (script: string) => {
    const statements: { text: string; start: number; end: number }[] = [];
    let start = 0;
    let inString = false;
    let quoteChar = '';
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < script.length; i++) {
        const c = script[i];
        const next = script[i + 1] || '';

        // 处理块注释
        if (inBlockComment) {
            if (c === '*' && next === '/') {
                inBlockComment = false;
                i++;
            }
            continue;
        }

        // 处理行注释
        if (inLineComment) {
            if (c === '\n') inLineComment = false;
            continue;
        }

        // 检测行注释开始
        if (!inString && c === '-' && next === '-') {
            inLineComment = true;
            i++;
            continue;
        }

        // 检测块注释开始
        if (!inString && c === '/' && next === '*') {
            inBlockComment = true;
            i++;
            continue;
        }

        // 处理字符串
        if (c === "'" || c === '"') {
            if (!inString) {
                inString = true;
                quoteChar = c;
            } else if (c === quoteChar) {
                if (next === quoteChar) i++;
                else inString = false;
            }
            continue;
        }

        // 处理语句分隔符
        if (!inString && c === ';') {
            statements.push({ text: script.substring(start, i + 1), start, end: i + 1 });
            start = i + 1;
        }
    }

    if (start < script.length && script.substring(start).trim()) {
        statements.push({ text: script.substring(start), start, end: script.length });
    }
    return statements;
};

export const enforceTypeConstraints = (val: any, rawType: string) => {
    if (val === null || val === undefined) return val;
    const strVal = String(val);
    const typeUpper = parsePrimaryType(rawType).toUpperCase();
    const charMatch = typeUpper.match(/(?:VARCHAR|CHAR)\s*\((\d+)\)/);
    if (charMatch) {
        const maxLength = parseInt(charMatch[1], 10);
        if (strVal.length > maxLength) return strVal.substring(0, maxLength);
    }
    return val;
};

export const isApproxEqual = (a: number, b: number) => Math.abs(a - b) < 0.000001;

export const normalizeAndCompare = (dbVal: any, sqlValRaw: string): boolean => {
    let sqlVal = sqlValRaw ? sqlValRaw.trim() : '';
    if (sqlVal.toUpperCase() === 'NULL' || sqlVal === '') return dbVal === null || dbVal === undefined || dbVal === '';
    if (dbVal === null || dbVal === undefined) return false;

    const isQuoted = (sqlVal.startsWith("'") && sqlVal.endsWith("'")) || (sqlVal.startsWith('"') && sqlVal.endsWith('"'));
    if (isQuoted) {
        let unquoted = sqlVal.slice(1, -1).replace(/''/g, "'");
        unquoted = unquoted.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\\\/g, '\\');
        return String(dbVal) === unquoted || String(dbVal).trim() === unquoted.trim();
    }

    if (!isNaN(Number(dbVal)) && !isNaN(Number(sqlVal)) && dbVal !== '' && sqlVal !== '') {
        return isApproxEqual(Number(dbVal), Number(sqlVal));
    }
    return String(dbVal) === sqlVal;
};

export const parseExplicitColumns = (sql: string): string[] | null => {
    const match = sql.match(/INSERT\s+INTO\s+[\w`"']+\s*\(([\w`"',\s]+)\)/i);
    if (match) {
        return match[1].split(',').map(c => c.trim().replace(/[`"']/g, ''));
    }
    return null;
};

export const compareValuesForHighlight = (rowVal: any, operator: string, queryVal: string) => {
    let cleanQueryVal: string | number = queryVal;
    if (queryVal.startsWith("'") && queryVal.endsWith("'")) cleanQueryVal = queryVal.slice(1, -1);
    const n1 = Number(rowVal);
    const n2 = Number(cleanQueryVal);
    const isNum1 = !isNaN(n1) && rowVal !== '' && rowVal !== null;
    const isNum2 = !isNaN(n2) && cleanQueryVal !== '' && cleanQueryVal !== null;
    if (isNum1 && isNum2) {
        switch (operator) {
            case '=': return isApproxEqual(n1, n2);
            case '>': return n1 > n2;
            case '<': return n1 < n2;
            case '>=': return n1 >= n2;
            case '<=': return n1 <= n2;
            case '!=': case '<>': return !isApproxEqual(n1, n2);
        }
    }
    const s1 = String(rowVal);
    const s2 = String(cleanQueryVal);
    if (operator.toUpperCase() === 'LIKE') {
        const pattern = s2.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
        return new RegExp(`^${pattern}$`, 'i').test(s1);
    }
    switch (operator) {
        case '=': return s1 === s2;
        case '!=': case '<>': return s1 !== s2;
        case '>': return s1 > s2;
        case '<': return s1 < s2;
        case '>=': return s1 >= s2;
        case '<=': return s1 <= s2;
    }
    return false;
};
