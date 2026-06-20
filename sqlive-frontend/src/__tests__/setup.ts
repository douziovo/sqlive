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

// Default fetch mock — prevents "Cannot read properties of undefined" when
// components mount and auto-trigger SQL execution without explicit mock setup.
// Tests that need controlled responses override this via mockSuccess/mockReject.
const defaultFetch = () => Promise.resolve({
  status: 200,
  ok: true,
  json: () => Promise.resolve({ success: true, data: {} }),
  headers: { get: () => null }
})
globalThis.fetch = defaultFetch as any
