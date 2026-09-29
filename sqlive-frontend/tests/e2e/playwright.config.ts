import path from 'node:path'
import { defineConfig } from '@playwright/test'

const isWindows = process.platform === 'win32'

export default defineConfig({
    testDir: './specs',
    testMatch: '**/*.spec.ts',
    workers: 6,
    timeout: 30_000,
    expect: { timeout: 10_000 },
    use: {
        baseURL: 'http://127.0.0.1:5173',
        viewport: { width: 1440, height: 900 }
    },
    projects: [
        {
            name: 'chrome',
            use: {
                channel: 'chrome'
            }
        },
        {
            name: 'edge',
            use: {
                channel: 'msedge'
            }
        },
        {
            name: 'chromium',
            use: {
                browserName: 'chromium'
            }
        }
    ],
    webServer: [
        {
            command:
                process.env.BACKEND_BOOT_CMD ||
                (isWindows ? 'cmd /c ".\\gradlew.bat bootRun"' : './gradlew bootRun'),
            cwd: path.resolve(import.meta.dirname, '../../../sqlive-backend'),
            url: 'http://127.0.0.1:8080/health',
            reuseExistingServer: !process.env.CI,
            timeout: 180_000
        },
        {
            command: 'pnpm run dev -- --port 5173 --strictPort',
            url: 'http://127.0.0.1:5173',
            reuseExistingServer: !process.env.CI
        }
    ]
})
