<template>
  <article class="md-body prose-style" v-html="html"></article>
</template>

<script setup lang="ts">
// D-09: MarkdownRenderer receives sanitized HTML and renders via v-html.
// Sanitization happens in useDocArticle (shared sanitizeConfig); this
// component is a pure presentation layer with .md-body scoped styles.
//
// Scoped style block adapts AiChatPanel.vue's .md-body CSS (Plan 01 kept
// AiChatPanel's block; this is a copy for the docs article context with
// larger H1/H2/H3 sizing per UI-SPEC Typography — H2/H3 same 20px size,
// differentiated by margin, avoiding a 5th type size per UI-SPEC FLAG 2).

defineProps<{ html: string }>()
</script>

<style scoped>
.md-body { word-break: break-word; }
.md-body h1 { font-size: 1.5rem; font-weight: 700; margin: 1.2em 0 0.5em; line-height: 1.3; }
.md-body h2 { font-size: 1.25rem; font-weight: 600; margin: 1.1em 0 0.4em; line-height: 1.35; }
.md-body h3 { font-size: 1.25rem; font-weight: 600; margin: 0.9em 0 0.3em; line-height: 1.35; }
.md-body h4 { font-size: 1rem; font-weight: 600; margin: 0.8em 0 0.25em; }
.md-body p { margin: 0.6em 0; line-height: 1.7; }
.md-body p:first-child { margin-top: 0; }
.md-body p:last-child { margin-bottom: 0; }
.md-body ul, .md-body ol { padding-left: 1.5em; margin: 0.6em 0; }
.md-body li { margin: 0.2em 0; }
.md-body pre {
  background: #f8fafc; color: #334155; border: 1px solid #e2e8f0;
  padding: 0.9rem 1.1rem; border-radius: 0.5rem;
  overflow-x: auto; max-width: 100%;
  margin: 0.8em 0; font-size: 0.85rem; line-height: 1.6;
  white-space: pre-wrap;
}
.md-body code {
  font-family: var(--font-mono);
  font-size: 0.85em;
}
.md-body :not(pre) > code {
  background: var(--muted); color: var(--foreground);
  padding: 0.1em 0.35em; border-radius: 0.25rem;
}
.md-body table {
  width: 100%; border-collapse: collapse; margin: 0.8em 0;
  display: block; overflow-x: auto; max-width: 100%;
}
.md-body th, .md-body td {
  border: 1px solid #d1d5db; padding: 0.5rem 0.7rem;
  text-align: left; font-size: 0.85rem;
}
.md-body th { background: #f3f4f6; font-weight: 600; }
.md-body blockquote {
  border-left: 3px solid #d1d5db; padding-left: 1em;
  margin: 0.7em 0; color: #6b7280;
}
.md-body hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.2em 0; }
.md-body img { max-width: 100%; border-radius: 0.5rem; }
.md-body a { color: #2563eb; text-decoration: underline; }
.md-body strong { font-weight: 600; }
</style>
