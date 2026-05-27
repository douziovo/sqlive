// ECharts mock is set up per test file when needed

// Polyfill DOM APIs that monaco-editor calls during ESM module initialization
// Must run before any test file imports (vitest setupFiles guarantees this)
if (!('queryCommandSupported' in document)) {
  Object.defineProperty(document, 'queryCommandSupported', {
    value: (_cmd: string) => false,
    writable: false,
    configurable: true,
  });
}
