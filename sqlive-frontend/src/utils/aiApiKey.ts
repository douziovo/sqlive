import { STORAGE_KEYS } from '../constants/storageKeys'

/**
 * CR-02: resolve the X-API-Key value so the backend ApiKeyFilter authorizes
 * /api/ai/** in production (AI_API_KEY set). Build-time env var takes precedence;
 * fall back to localStorage so end users can paste a key without rebuilding. typeof
 * guard keeps callers testable in non-browser contexts.
 */
export function resolveAiApiKey(): string | null {
    if (import.meta.env.VITE_AI_API_KEY) return import.meta.env.VITE_AI_API_KEY
    try {
        return typeof localStorage !== 'undefined'
            ? localStorage.getItem(STORAGE_KEYS.aiApiKey)
            : null
    } catch {
        return null
    }
}
