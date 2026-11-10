import path from 'node:path'

import { defineConfig } from '@playwright/test'

const isWindows = process.platform === 'win32'

//noinspection JSUnusedGlobalSymbols -- Playwright 配置文件约定：default export 由 @playwright/test CLI 读取，代码内无引用
export default defineConfig({
    testDir: './specs',
    testMatch: '**/*.spec.ts',
    workers: process.env.CI ? 2 : 6,
    forbidOnly: Boolean(process.env.CI),
    globalTimeout: process.env.CI ? 15 * 60_000 : 0,
    timeout: 30_000,
    expect: { timeout: 10_000 },
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
    use: {
        baseURL: 'http://127.0.0.1:5173',
        viewport: { width: 1440, height: 900 },
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure'
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
            name: 'Backend',
            command:
                process.env.BACKEND_BOOT_CMD ??
                (isWindows ? 'cmd /c ".\\gradlew.bat bootRun"' : './gradlew bootRun'),
            cwd: path.resolve(import.meta.dirname, '../../../sqlive-backend'),
            url: 'http://127.0.0.1:8080/health',
            reuseExistingServer: !process.env.CI,
            timeout: 180_000,
            gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 }
        },
        {
            name: 'Frontend',
            command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort',
            cwd: path.resolve(import.meta.dirname, '../..'),
            url: 'http://127.0.0.1:5173',
            reuseExistingServer: !process.env.CI,
            gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 }
        }
    ]
})
