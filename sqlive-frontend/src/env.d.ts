interface ImportMetaEnv {
    readonly VITE_API_URL?: string
    readonly VITE_AI_API_URL?: string
    readonly VITE_KNOWLEDGE_API_URL?: string
    readonly VITE_AI_API_KEY?: string
    readonly VITE_DEBOUNCE_MS?: string
}

interface Window {
    monaco?: typeof import('monaco-editor/editor/editor.api')
}
