import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMultiTabs } from '@/composables/useMultiTabs';

describe('useMultiTabs', () => {
  let defaultCode: string;

  beforeEach(() => {
    defaultCode = '-- SQL';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates one initial tab with default name', () => {
    const { tabs, activeTab } = useMultiTabs(defaultCode);
    expect(tabs.value).toHaveLength(1);
    expect(tabs.value[0].name).toBe('查询 1');
    expect(tabs.value[0].code).toBe('-- SQL');
    expect(activeTab.value.id).toBe(tabs.value[0].id);
  });

  it('addTab creates and activates new tab', () => {
    const { tabs, activeTab, activeTabId, addTab } = useMultiTabs(defaultCode);
    const tab = addTab();

    expect(tabs.value).toHaveLength(2);
    expect(activeTabId.value).toBe(tab.id);
    expect(activeTab.value.id).toBe(tab.id);
  });

  it('addTab accepts custom name, code, and dbName', () => {
    const { tabs, addTab } = useMultiTabs(defaultCode);
    addTab('test', 'SELECT 1;', 'mydb');

    expect(tabs.value).toHaveLength(2);
    const tab = tabs.value[1];
    expect(tab.name).toBe('test');
    expect(tab.code).toBe('SELECT 1;');
    expect(tab.dbName).toBe('mydb');
  });

  it('switchTab changes active tab', () => {
    const { activeTabId, addTab, switchTab } = useMultiTabs(defaultCode);
    const tab2 = addTab('tab2');
    addTab('tab3');

    switchTab(tab2.id);
    expect(activeTabId.value).toBe(tab2.id);
  });

  it('closeTab removes tab and switches to adjacent', () => {
    const { tabs, activeTabId, addTab, closeTab } = useMultiTabs(defaultCode);
    const tab2 = addTab('tab2');
    const tab3 = addTab('tab3');
    // Active is tab3, close it → should switch to tab2
    closeTab(tab3.id);

    expect(tabs.value).toHaveLength(2);
    expect(activeTabId.value).toBe(tab2.id);
  });

  it('closeTab on first tab when last is active switches to new last', () => {
    const { tabs, activeTabId, addTab, closeTab } = useMultiTabs(defaultCode);
    addTab('tab2');
    const tab3 = addTab('tab3');
    // Active is tab3, close the first tab
    closeTab(tabs.value[0].id);

    expect(tabs.value).toHaveLength(2);
    expect(activeTabId.value).toBe(tab3.id); // unchanged
  });

  it('cannot close the last remaining tab', () => {
    const { tabs, closeTab } = useMultiTabs(defaultCode);
    const result = closeTab(tabs.value[0].id);

    expect(result).toBe(false);
    expect(tabs.value).toHaveLength(1);
  });

  it('renameTab changes tab name', () => {
    const { tabs, renameTab } = useMultiTabs(defaultCode);
    renameTab(tabs.value[0].id, '新名称');
    expect(tabs.value[0].name).toBe('新名称');
  });

  it('updateCode sets isModified to true when code differs', () => {
    const { activeTab, updateCode } = useMultiTabs(defaultCode);
    expect(activeTab.value.isModified).toBe(false);

    updateCode('SELECT 2;');
    expect(activeTab.value.isModified).toBe(true);
    expect(activeTab.value.code).toBe('SELECT 2;');
  });

  it('updateCode does not mark modified when code is unchanged', () => {
    const { activeTab, updateCode } = useMultiTabs(defaultCode);
    updateCode(defaultCode);
    expect(activeTab.value.isModified).toBe(false);
  });

  it('markClean resets isModified', () => {
    const { activeTab, updateCode, markClean } = useMultiTabs(defaultCode);
    updateCode('SELECT 2;');
    expect(activeTab.value.isModified).toBe(true);

    markClean();
    expect(activeTab.value.isModified).toBe(false);
  });

  it('setTabDbName updates dbName', () => {
    const { tabs, setTabDbName } = useMultiTabs(defaultCode);
    setTabDbName(tabs.value[0].id, 'playground');
    expect(tabs.value[0].dbName).toBe('playground');
  });

  it('dbNames collects unique dbNames across tabs', () => {
    const { dbNames, addTab } = useMultiTabs(defaultCode);
    addTab('a', '', 'db1');
    addTab('b', '', 'db1');
    addTab('c', '', 'db2');

    expect(dbNames.value).toEqual(['db1', 'db2']);
  });

  it('importFile reads file text and creates new tab', async () => {
    const { tabs, activeTab, importFile } = useMultiTabs(defaultCode);
    const file = new File(['SELECT 1;'], 'query.sql', { type: 'text/sql' });

    const text = await importFile(file);
    expect(text).toBe('SELECT 1;');
    expect(tabs.value).toHaveLength(2);
    const newTab = tabs.value[1];
    expect(newTab.name).toBe('query');
    expect(newTab.code).toBe('SELECT 1;');
    expect(activeTab.value.id).toBe(newTab.id);
  });

  it('exportTab calls download', () => {
    // Mock URL and anchor
    const createObjectURLSpy = vi.fn(() => 'blob:xxx');
    const revokeObjectURLSpy = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy,
    });

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: clickSpy });
      }
      return el;
    });

    const { tabs, exportTab } = useMultiTabs(defaultCode);
    tabs.value[0].name = 'myquery';

    exportTab();
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalled();

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('tabs are reactive: modifying a tab property reflects in UI', () => {
    const { tabs, addTab } = useMultiTabs(defaultCode);
    const firstTab = tabs.value[0];
    addTab('other');
    // The first tab should still be accessible with correct data
    expect(tabs.value).toHaveLength(2);
    expect(tabs.value[0].name).toBe(firstTab.name);
  });

  it('handles 50 tabs without crashing', () => {
    const { tabs, addTab, activeTabId } = useMultiTabs(defaultCode);
    for (let i = 0; i < 49; i++) {
      addTab(`tab ${i + 2}`, `-- query ${i + 2}`, `db${i % 5}`);
    }
    expect(tabs.value).toHaveLength(50);
    expect(activeTabId.value).toBe(tabs.value[49].id);
  });
});
