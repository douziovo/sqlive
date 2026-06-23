// ECharts mock is set up per test file when needed

// Polyfill DOM APIs that monaco-editor calls during ESM module initialization
// Must run before any test file imports (vitest setupFiles guarantees this)
if (!('queryCommandSupported' in document)) {
  Object.defineProperty(document, 'queryCommandSupported', {
    value: (_cmd: string) => false,
    writable: false,
    configurable: true
  })
}

// Polyfill ResizeObserver for VueFlow/jsdom compatibility
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// No default fetch mock — tests that need fetch must explicitly mock it
// via mockSuccess/mockError/mockReject from test-utils.ts
