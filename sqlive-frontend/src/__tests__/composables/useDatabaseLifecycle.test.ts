import {describe, expect, it, vi} from 'vitest'
import {ref} from 'vue'
import type {Tab} from '@/composables/useMultiTabs'
import {useDatabaseLifecycle} from '@/composables/useDatabaseLifecycle'

type EngineMode = 'user' | 'reconciling' | 'rollback'

function makeTab(overrides: Partial<Tab> = {}): Tab {
    return {
        id: 'tab_1',
        name: 'Query 1',
        code: 'SELECT 1;',
        dbName: '',
        isModified: false,
        ...overrides
    }
}

function makeTransitionFn() {
    return (_from: EngineMode, to: EngineMode, _ctx: string): EngineMode => to
}

function setup(tabs: Tab[] = [makeTab()], activeIndex = 0) {
    const tabsRef = ref(tabs)
    const activeTab = ref(tabs[activeIndex]) as any
    const mode = ref<EngineMode>('user')
    const executeSqlRemote = vi.fn().mockResolvedValue(undefined)
    const setTabDbName = vi.fn((id: string, name: string) => {
        const tab = tabsRef.value.find((t) => t.id === id)
        if (tab) tab.dbName = name
    })
    const transitionFn = makeTransitionFn()

    const lifecycle = useDatabaseLifecycle(
        activeTab,
        tabsRef,
        setTabDbName,
        mode,
        executeSqlRemote,
        transitionFn
    )

    return {lifecycle, tabsRef, activeTab, mode, executeSqlRemote, setTabDbName}
}

describe('useDatabaseLifecycle', () => {
    describe('shouldReset', () => {
        it('returns true when dbName is empty', () => {
            const {lifecycle} = setup()
            expect(lifecycle.shouldReset('SELECT 1;', '')).toBe(true)
        })

        it('returns true when dbName is not in committedDbNames', () => {
            const {lifecycle} = setup()
            expect(lifecycle.shouldReset('SELECT 1;', 'newdb')).toBe(true)
        })

        it('returns false when dbName is in committedDbNames', () => {
            const {lifecycle, activeTab} = setup()
            activeTab.value.dbName = 'mydb'
            lifecycle.submitNow()
            expect(lifecycle.shouldReset('SELECT 1;', 'mydb')).toBe(false)
        })
    })

    describe('submitNow', () => {
        it('adds dbName to committedDbNames', () => {
            const {lifecycle, activeTab} = setup()
            activeTab.value.dbName = 'mydb'

            lifecycle.submitNow()

            expect(lifecycle.committedDbNames.value.has('mydb')).toBe(true)
        })

        it('transitions mode to user', () => {
            const {lifecycle, activeTab, mode} = setup()
            activeTab.value.dbName = 'mydb'

            lifecycle.submitNow()

            expect(mode.value).toBe('user')
        })

        it('calls executeSqlRemote with true (forceReset)', () => {
            const {lifecycle, activeTab, executeSqlRemote} = setup()
            activeTab.value.dbName = 'mydb'

            lifecycle.submitNow()

            expect(executeSqlRemote).toHaveBeenCalledWith(true)
        })

        it('does nothing when activeTab has no dbName', () => {
            const {lifecycle, executeSqlRemote} = setup()
            // dbName defaults to '' in makeTab
            lifecycle.submitNow()

            expect(executeSqlRemote).not.toHaveBeenCalled()
        })

        it('dbList includes submitted db names sorted', () => {
            const {lifecycle, activeTab} = setup()

            activeTab.value.dbName = 'zdb'
            lifecycle.submitNow()
            activeTab.value.dbName = 'adb'
            lifecycle.submitNow()

            expect(lifecycle.dbList.value).toEqual(['adb', 'zdb'])
        })
    })

    describe('deleteDb', () => {
        it('removes dbName from committedDbNames', () => {
            const {lifecycle, activeTab} = setup()
            activeTab.value.dbName = 'mydb'
            lifecycle.submitNow()

            lifecycle.deleteDb('mydb')

            expect(lifecycle.committedDbNames.value.has('mydb')).toBe(false)
        })

        it('clears dbName from tabs matching the deleted name', () => {
            const tab1 = makeTab({id: 'tab_1', dbName: 'shared_db'})
            const tab2 = makeTab({id: 'tab_2', dbName: 'shared_db'})
            const tab3 = makeTab({id: 'tab_3', dbName: 'other_db'})
            const {lifecycle, setTabDbName} = setup([tab1, tab2, tab3])

            lifecycle.deleteDb('shared_db')

            expect(setTabDbName).toHaveBeenCalledWith('tab_1', '')
            expect(setTabDbName).toHaveBeenCalledWith('tab_2', '')
            // tab3 should not be touched
            expect(setTabDbName).not.toHaveBeenCalledWith('tab_3', '')
        })

        it('dbList no longer includes deleted db', () => {
            const {lifecycle, activeTab} = setup()
            activeTab.value.dbName = 'mydb'
            lifecycle.submitNow()
            expect(lifecycle.dbList.value).toContain('mydb')

            lifecycle.deleteDb('mydb')
            expect(lifecycle.dbList.value).not.toContain('mydb')
        })
    })

    describe('dbList', () => {
        it('is empty initially', () => {
            const {lifecycle} = setup()
            expect(lifecycle.dbList.value).toEqual([])
        })

        it('reflects committed db names', () => {
            const {lifecycle, activeTab} = setup()
            activeTab.value.dbName = 'db1'
            lifecycle.submitNow()
            activeTab.value.dbName = 'db2'
            lifecycle.submitNow()

            expect(lifecycle.dbList.value).toEqual(['db1', 'db2'])
        })
    })

    describe('committedDbNames', () => {
        it('is empty Set initially', () => {
            const {lifecycle} = setup()
            expect(lifecycle.committedDbNames.value.size).toBe(0)
        })
    })
})
