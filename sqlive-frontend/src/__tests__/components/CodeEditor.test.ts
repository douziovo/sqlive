import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { AI_ACTIONS_KEY, SQL_CONTEXT_KEY } from '@/model/injectionKeys'
import type { AiActions } from '@/composables/useAiChat'

// The monaco-backed composable is covered by its own test file; here we only
// need to observe how the component drives it.
const { createMock, syncCodeMock, disposeMock, openFilePickerArg } = vi.hoisted(() => ({
    createMock: vi.fn(),
    syncCodeMock: vi.fn(),
    disposeMock: vi.fn(),
    openFilePickerArg: { current: null as null | (() => void) }
}))
vi.mock('@/composables/useMonacoEditor', () => ({
    useMonacoEditor: vi.fn((...args: unknown[]) => {
        openFilePickerArg.current = args[3] as () => void
        return {
            create: createMock,
            syncCode: syncCodeMock,
            dispose: disposeMock
        }
    })
}))

const promptMock = vi.fn()
const confirmMock = vi.fn()
const alertMock = vi.fn()
vi.stubGlobal('prompt', promptMock)
vi.stubGlobal('confirm', confirmMock)
vi.stubGlobal('alert', alertMock)

import CodeEditor from '@/components/CodeEditor.vue'

const tabs = ref([
    { id: 't1', name: '查询1', code: 'SELECT 1;', dbName: '', isModified: false },
    { id: 't2', name: '查询2', code: 'SELECT 2;', dbName: 'db_two', isModified: false }
])
const activeTabId = ref('t1')
const activeDbName = ref('')
const dbList = ref(['db_two'])

function makeAi(overrides: Partial<AiActions> = {}): AiActions {
    return {
        isLoading: ref(false),
        analyzeError: vi.fn(),
        fixCode: vi.fn(),
        explain: vi.fn(),
        optimize: vi.fn(),
        generateSql: vi.fn(),
        onOpenChat: vi.fn(),
        sendToAi: vi.fn(),
        onTogglePanel: vi.fn(),
        ...overrides
    } as AiActions
}

let wrapper: VueWrapper
function mountEditor(props: { code?: string; ai?: AiActions | null } = {}) {
    wrapper = mount(CodeEditor, {
        props: { code: props.code ?? 'SELECT 1;' },
        global: {
            provide: {
                [SQL_CONTEXT_KEY as symbol]: {
                    tabs,
                    activeTabId,
                    activeDbName,
                    dbList,
                    highlightChunk: ref<string | null>(null),
                    error: ref<{ line: number; message: string } | null>(null),
                    schemaTables: ref([]),
                    db: {},
                    highlight: {},
                    lastTruncations: ref([]),
                    insertResult: ref(null)
                },
                [AI_ACTIONS_KEY as symbol]: props.ai ?? makeAi()
            }
        }
    })
    return wrapper
}

beforeEach(() => {
    createMock.mockClear()
    syncCodeMock.mockClear()
    disposeMock.mockClear()
    activeTabId.value = 't1'
    activeDbName.value = ''
    promptMock.mockReset()
    confirmMock.mockReset()
    alertMock.mockReset()
})

afterEach(() => {
    wrapper?.unmount()
})

describe('CodeEditor', () => {
    it('creates the monaco editor on mount with the initial code', () => {
        mountEditor({ code: 'SELECT 42;' })
        expect(createMock).toHaveBeenCalledWith('SELECT 42;')
    })

    it('syncs the editor when the code prop changes', async () => {
        mountEditor({ code: 'SELECT 1;' })
        await wrapper.setProps({ code: 'SELECT 2;' })
        expect(syncCodeMock).toHaveBeenCalledWith('SELECT 2;')
    })

    it('disposes the editor on unmount', () => {
        mountEditor()
        wrapper.unmount()
        expect(disposeMock).toHaveBeenCalledTimes(1)
    })

    it('renders tabs and highlights the active one', () => {
        mountEditor()
        expect(wrapper.text()).toContain('查询1')
        expect(wrapper.text()).toContain('查询2')
        expect(wrapper.text()).toContain('db_two')
    })

    it('emits switch-tab / close-tab / add-tab from the tab bar', async () => {
        mountEditor()
        await wrapper.find('[title="查询2 · db_two"]').trigger('click')
        expect(wrapper.emitted('switch-tab')).toEqual([['t2']])

        const closeBtn = wrapper.find('[data-testid="tab-close-btn"]')
        await closeBtn.trigger('click')
        expect(wrapper.emitted('close-tab')).toEqual([['t1']])

        await wrapper.find('[title="新建标签页"]').trigger('click')
        expect(wrapper.emitted('add-tab')).toHaveLength(1)
    })

    it('emits set-db-name when the DB selector changes', async () => {
        mountEditor()
        await wrapper.find('select').setValue('db_two')
        expect(wrapper.emitted('set-db-name')).toEqual([['t1', 'db_two']])
    })

    it('shows the delete-DB button only when a DB is active and emits delete-db after confirm', async () => {
        mountEditor()
        expect(wrapper.find('button[title="删除数据库"]').exists()).toBe(false)

        activeDbName.value = 'db_two'
        await nextTick()
        const delBtn = wrapper.find('button[title="删除数据库"]')
        expect(delBtn.exists()).toBe(true)

        confirmMock.mockReturnValue(true)
        await delBtn.trigger('click')
        expect(wrapper.emitted('delete-db')).toEqual([['db_two']])
    })

    it('does not emit delete-db when the confirm dialog is dismissed', async () => {
        mountEditor()
        activeDbName.value = 'db_two'
        await nextTick()
        confirmMock.mockReturnValue(false)
        await wrapper.find('button[title="删除数据库"]').trigger('click')
        expect(wrapper.emitted('delete-db')).toBeUndefined()
    })

    it('submits directly when a database is already active', async () => {
        mountEditor()
        activeDbName.value = 'db_two'
        await nextTick()
        await wrapper.find('button[title="提交到数据库 (Ctrl+Shift+T)"]').trigger('click')
        expect(wrapper.emitted('submit')).toHaveLength(1)
        expect(promptMock).not.toHaveBeenCalled()
    })

    it('prompts for a DB name when submitting in live mode and emits set-db-name + submit', async () => {
        mountEditor()
        promptMock.mockReturnValue('my_db')
        await wrapper.find('button[title="提交到数据库 (Ctrl+Shift+T)"]').trigger('click')
        expect(wrapper.emitted('set-db-name')).toEqual([['t1', 'my_db']])
        expect(wrapper.emitted('submit')).toHaveLength(1)
    })

    it('blocks submit when the prompt is cancelled or empty', async () => {
        mountEditor()
        promptMock.mockReturnValue('  ')
        await wrapper.find('button[title="提交到数据库 (Ctrl+Shift+T)"]').trigger('click')
        expect(wrapper.emitted('submit')).toBeUndefined()
    })

    it('alerts and blocks submit on an invalid DB name', async () => {
        mountEditor()
        promptMock.mockReturnValue('bad name!')
        await wrapper.find('button[title="提交到数据库 (Ctrl+Shift+T)"]').trigger('click')
        expect(alertMock).toHaveBeenCalled()
        expect(wrapper.emitted('submit')).toBeUndefined()
    })

    it('toggles the AI panel from the AI button and reflects loading state', async () => {
        const ai = makeAi()
        mountEditor({ ai })
        const btn = wrapper.find('[data-testid="ai-toggle-btn"]')
        expect(btn.text()).toContain('AI助手')

        await btn.trigger('click')
        expect(ai.onTogglePanel).toHaveBeenCalledTimes(1)

        ai.isLoading.value = true
        await nextTick()
        expect(wrapper.find('[data-testid="ai-toggle-btn"]').classes()).toContain('animate-pulse')
    })

    it('tab search: filters tabs, highlights match, switches on click and on Enter', async () => {
        mountEditor()
        // Open the dropdown
        await wrapper.find('button[title="搜索标签页"]').trigger('click')
        await nextTick()
        const input = wrapper.find('input[placeholder="搜索标签页..."]')
        expect(input.exists()).toBe(true)

        await input.setValue('查询2')
        await nextTick()
        // Only the matching tab row is listed
        const rows = wrapper.findAll('.cursor-pointer.text-sm')
        expect(rows.length).toBe(1)

        // Highlight wraps the matched part
        expect(wrapper.find('span > mark').exists()).toBe(true)

        await rows[0].trigger('click')
        expect(wrapper.emitted('switch-tab')).toEqual([['t2']])
        // Dropdown closes after selection
        expect(wrapper.find('input[placeholder="搜索标签页..."]').exists()).toBe(false)
    })

    it('tab search: shows the no-match hint and Enter picks the first match', async () => {
        mountEditor()
        await wrapper.find('button[title="搜索标签页"]').trigger('click')
        const input = wrapper.find('input[placeholder="搜索标签页..."]')
        await input.setValue('不存在')
        await nextTick()
        expect(wrapper.text()).toContain('无匹配标签页')

        await input.setValue('查询1')
        await input.trigger('keydown.enter')
        expect(wrapper.emitted('switch-tab')).toEqual([['t1']])
    })

    it('tab search: Escape and the click-outside overlay close the dropdown', async () => {
        mountEditor()
        await wrapper.find('button[title="搜索标签页"]').trigger('click')
        const overlay = wrapper.find('.fixed.inset-0')
        expect(overlay.exists()).toBe(true)
        await overlay.trigger('click')
        expect(wrapper.find('input[placeholder="搜索标签页..."]').exists()).toBe(false)

        await wrapper.find('button[title="搜索标签页"]').trigger('click')
        await wrapper.find('input[placeholder="搜索标签页..."]').trigger('keydown.esc')
        expect(wrapper.find('input[placeholder="搜索标签页..."]').exists()).toBe(false)
    })

    it('emits import-file for dropped .sql/.txt files and ignores others', async () => {
        mountEditor()
        const root = wrapper.find('.h-full')

        const sqlFile = new File(['SELECT 1;'], 'dump.sql')
        await root.trigger('drop', { dataTransfer: { files: [sqlFile] } })
        expect(wrapper.emitted('import-file')).toEqual([[sqlFile]])

        const pngFile = new File(['x'], 'img.png')
        await root.trigger('drop', { dataTransfer: { files: [pngFile] } })
        expect(wrapper.emitted('import-file')).toHaveLength(1)

        // dragover shows the drop overlay
        await root.trigger('dragover')
        await nextTick()
        expect(wrapper.find('.pointer-events-none').exists()).toBe(true)
        await root.trigger('dragleave')
        await nextTick()
        expect(wrapper.find('.pointer-events-none').exists()).toBe(false)
    })

    it('emits import-file when the hidden file input changes', async () => {
        mountEditor()
        const fileInput = wrapper.find('input[type="file"]')
        const file = new File(['SELECT 1;'], 'a.sql')
        Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true })
        await fileInput.trigger('change')
        expect(wrapper.emitted('import-file')).toEqual([[file]])
    })

    it("opens the native file picker from the editor's open-file action", async () => {
        mountEditor()
        expect(openFilePickerArg.current).toBeTypeOf('function')
        const fileInput = wrapper.find('input[type="file"]')
        const clickSpy = vi.spyOn(fileInput.element as HTMLInputElement, 'click')
        openFilePickerArg.current!()
        expect(clickSpy).toHaveBeenCalledTimes(1)
    })

    it('tab search: close button in the dropdown closes that tab', async () => {
        mountEditor()
        await wrapper.find('button[title="搜索标签页"]').trigger('click')
        const closeBtn = wrapper
            .findAll('button')
            .find((b) => b.text().includes('✕') && b.classes().includes('shrink-0'))
        expect(closeBtn).toBeTruthy()
        await closeBtn!.trigger('click')
        expect(wrapper.emitted('close-tab')).toEqual([['t1']])
        // Dropdown stays open so the user can search for the next tab
        expect(wrapper.find('input[placeholder="搜索标签页..."]').exists()).toBe(true)
    })

    it('delete-DB guard: a click landing after the DB was cleared does nothing', async () => {
        mountEditor()
        activeDbName.value = 'db_two'
        await nextTick()
        const delBtn = wrapper.find('button[title="删除数据库"]')
        expect(delBtn.exists()).toBe(true)
        // Simulate the active DB being switched off live mode between render and click
        activeDbName.value = ''
        await delBtn.trigger('click')
        expect(confirmMock).not.toHaveBeenCalled()
        expect(wrapper.emitted('delete-db')).toBeUndefined()
    })
})
