import { ref, computed } from 'vue';
import { downloadFile } from '../utils/file';

export interface Tab {
  id: string;
  name: string;
  code: string;
  dbName: string;
  isModified: boolean;
}

let tabCounter = 0;
function nextId() { return 'tab_' + (++tabCounter) + '_' + Date.now(); }
function nextName() { return '查询 ' + tabCounter; }

export function useMultiTabs(defaultCode: string) {
  const tabs = ref<Tab[]>([{
    id: nextId(),
    name: '查询 1',
    code: defaultCode,
    dbName: typeof window !== 'undefined' && window.location.search.includes('e2e=1')
      ? 'e2e_' + Math.random().toString(36).slice(2, 10)
      : '',
    isModified: false,
  }]);
  const activeTabId = ref(tabs.value[0].id);

  const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value)!);

  function findTab(id: string): Tab | undefined {
    return tabs.value.find(t => t.id === id);
  }

  function switchTab(id: string) {
    activeTabId.value = id;
  }

  function addTab(name?: string, code?: string, dbName?: string) {
    const tab: Tab = {
      id: nextId(),
      name: name || nextName(),
      code: code || '',
      dbName: dbName || '',
      isModified: false,
    };
    tabs.value.push(tab);
    activeTabId.value = tab.id;
    return tab;
  }

  function closeTab(id: string) {
    if (tabs.value.length <= 1) return false;
    const idx = tabs.value.findIndex(t => t.id === id);
    if (idx === -1) return false;
    tabs.value.splice(idx, 1);
    if (activeTabId.value === id) {
      activeTabId.value = tabs.value[Math.min(idx, tabs.value.length - 1)].id;
    }
    return true;
  }

  function renameTab(id: string, name: string) {
    const tab = findTab(id);
    if (tab) tab.name = name;
  }

  function setTabDbName(id: string, dbName: string) {
    const tab = findTab(id);
    if (tab) tab.dbName = dbName;
  }

  const dbNames = computed(() => {
    const set = new Set<string>();
    for (const t of tabs.value) if (t.dbName) set.add(t.dbName);
    return Array.from(set);
  });

  function updateCode(code: string) {
    const tab = findTab(activeTabId.value);
    if (tab && tab.code !== code) {
      tab.code = code;
      tab.isModified = true;
    }
  }

  function markClean() {
    const tab = findTab(activeTabId.value);
    if (tab) tab.isModified = false;
  }

  // --- Import ---
  async function importFile(file: File): Promise<string> {
    const text = await file.text();
    const name = file.name.replace(/\.sql$/i, '') || '导入';
    addTab(name, text);
    return text;
  }

  // --- Export ---
  function exportTab(id?: string) {
    const tab = findTab(id || activeTabId.value);
    if (!tab) return;
    downloadFile(tab.name + '.sql', tab.code);
  }

  function exportAllTabs() {
    for (const tab of tabs.value) {
      downloadFile(tab.name + '.sql', tab.code);
    }
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    switchTab,
    addTab,
    closeTab,
    renameTab,
    setTabDbName,
    dbNames,
    updateCode,
    markClean,
    importFile,
    exportTab,
    exportAllTabs,
  };
}
