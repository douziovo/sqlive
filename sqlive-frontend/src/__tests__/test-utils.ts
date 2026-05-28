import { vi } from 'vitest';
import type { useSqlEngine } from '../composables/useSqlEngine';
import type { useAiChat } from '../composables/useAiChat';

export function jsonOk(data: any) {
  return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve(data) });
}

export function mockSuccess(fetchSpy: ReturnType<typeof vi.fn>, data: any) {
  fetchSpy.mockResolvedValue(jsonOk({ success: true, data }));
}

export function mockError(fetchSpy: ReturnType<typeof vi.fn>, message: string, line: number) {
  fetchSpy.mockResolvedValue(jsonOk({ success: false, error: { message, line } }));
}

export function mockReject(fetchSpy: ReturnType<typeof vi.fn>, err: Error) {
  fetchSpy.mockRejectedValue(err);
}

export async function tick(ms = 150) {
  await vi.advanceTimersByTimeAsync(ms);
}

const API_URL = 'http://localhost:8080/api/execute';

export interface SqlEngineSetup {
  useSqlEngine: typeof useSqlEngine;
  fetchSpy: ReturnType<typeof vi.fn>;
}

export async function setupSqlEngine(): Promise<SqlEngineSetup> {
  vi.useFakeTimers();
  const fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as any;
  vi.resetModules();
  const mod = await import('../composables/useSqlEngine');
  const useSqlEngine = mod.useSqlEngine;
  return { useSqlEngine, fetchSpy };
}

export interface AiChatSetup {
  useAiChat: typeof useAiChat;
  fetchSpy: ReturnType<typeof vi.fn>;
}

export async function setupAiChat(): Promise<AiChatSetup> {
  vi.useFakeTimers();
  const fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as any;

  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  });

  vi.resetModules();
  const mod = await import('../composables/useAiChat');
  const useAiChat = mod.useAiChat;
  return { useAiChat, fetchSpy };
}

export function teardownSqlEngine() {
  vi.useRealTimers();
  vi.restoreAllMocks();
}

export { API_URL };
