//noinspection JSAnnotator -- vitest/config 的 triple-slash 类型引用是 vitest 官方约定，该库不在本 tsconfig 的 project 范围内
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [vue(), tailwindcss()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    optimizeDeps: {
        include: ['monaco-editor']
    },
    worker: {
        format: 'es'
    },
    server: {
        proxy: {
            '/api': 'http://localhost:8080',
            '/v3/api-docs': 'http://localhost:8080',
            '/swagger-ui': 'http://localhost:8080'
        }
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id: string) {
                    if (id.includes('monaco-editor')) return 'monaco'
                }
            }
        }
    },
    test: {
        // Per-file isolation is kept on purpose: both env-reuse options suggested by Vitest
        // fail this suite — pool: 'vmThreads' breaks SSE tests (TransformStream is undefined
        // inside the VM context), and isolate: false leaks cross-file DOM/timer state
        // (TaskItem Teleport remnants crash DocsSearchBox, useAiStreaming/useGraphViewport flake).
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/__tests__/setup.ts'],
        exclude: ['tests/e2e/**', 'node_modules/**'],
        env: {
            VITE_API_URL: 'http://localhost:8080/api/execute'
        },
        onConsoleLog(log) {
            if (log.includes('[Vue Flow]')) return false
            if (log.includes('Extraneous non-props attributes')) return false
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary'],
            thresholds: {
                statements: 98,
                branches: 91,
                functions: 98,
                lines: 98
            },
            include: ['src/composables/**', 'src/utils/**', 'src/components/**'],
            exclude: [
                'src/__tests__/**',
                'src/main.ts',
                '**/*.d.ts',
                'src/components/ai-elements/**'
            ]
        }
    }
})
