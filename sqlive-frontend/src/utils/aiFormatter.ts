// Pure Markdown formatting functions for AI inline results.
// Zero dependencies — input: API response data, output: Markdown string.

interface ErrorAnalysisData {
    summary?: string
    content?: string
    fixedCode?: string
    tips?: string[]
}

interface FixCodeData {
    summary?: string
    fixedCode?: string
    explanation?: string
}

interface ExplainData {
    summary?: string
    content?: string
    stepByStep?: { step: number; what: string; why: string }[]
    tips?: string[]
}

interface OptimizeData {
    summary?: string
    fixedCode?: string
    explanation?: string
    content?: string
}

export function formatErrorAnalysis(d: ErrorAnalysisData): string {
    let content = ''
    if (d.summary) content += `## 🔍 错误原因\n${d.summary}\n\n`
    if (d.content) content += `## 📝 详细分析\n${d.content}\n\n`
    if (d.fixedCode) content += `## ✅ 修复方案\n\`\`\`sql\n${d.fixedCode}\n\`\`\`\n\n`
    if (d.tips?.length) content += `## 🛡️ 如何避免\n${d.tips.map((t: string) => `- ${t}`).join('\n')}\n`
    return content
}

export function formatFixCode(d: FixCodeData, options: { originalCode: string }): string {
    let content = `## 🔧 修复方案\n\n`
    if (d.summary) content += `${d.summary}\n\n`
    content += `### 原始代码\n\`\`\`sql\n${options.originalCode}\n\`\`\`\n\n`
    content += `### 修复后\n\`\`\`sql\n${d.fixedCode}\n\`\`\`\n`
    if (d.explanation) content += `\n${d.explanation}`
    return content
}

export function formatExplain(d: ExplainData): string {
    let content = ''
    if (d.summary) content += `**概述**\n${d.summary}\n\n`
    if (d.stepByStep?.length) {
        content += '**逐句拆解**\n\n'
        d.stepByStep.forEach((s) => {
            content += `**${s.step}. ${s.what}**\n${s.why}\n\n`
        })
    }
    if (d.tips?.length) {
        content += '**💡 使用提示**\n'
        d.tips.forEach((t: string) => {
            content += `- ${t}\n`
        })
    }
    if (d.content) content += `\n${d.content}`
    return content
}

export function formatOptimize(d: OptimizeData, options: { selectedCode: string }): string {
    const optimizedCode = d.fixedCode || ''
    let content = ''
    if (d.summary) content += `## ⚡ 优化建议\n${d.summary}\n\n`
    if (optimizedCode) {
        content += `### 原始代码\n\`\`\`sql\n${options.selectedCode}\n\`\`\`\n\n`
        content += `### 优化后\n\`\`\`sql\n${optimizedCode}\n\`\`\`\n`
    }
    if (d.explanation) content += `\n${d.explanation}`
    if (d.content) content += `\n${d.content}`
    return content
}

export function formatGenerateSql(result: string): string {
    return `## ✨ 生成的 SQL\n\n\`\`\`sql\n${result}\n\`\`\``
}

export function extractSqlFromMarkdown(text: string): string | undefined {
    return text.match(/```sql\n([\s\S]*?)\n```/)?.[1]?.trim()
}
