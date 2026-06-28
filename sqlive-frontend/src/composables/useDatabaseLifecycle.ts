import {computed, type Ref, ref} from 'vue'
import type {Tab} from './useMultiTabs'

type EngineMode = 'user' | 'reconciling' | 'rollback'

export function useDatabaseLifecycle(
    activeTab: Ref<Tab>,
    tabs: Ref<Tab[]>,
    setTabDbName: (id: string, name: string) => void,
    mode: Ref<EngineMode>,
    executeSqlRemote: (forceReset?: boolean) => Promise<void>,
    transitionFn: (from: EngineMode, to: EngineMode, ctx: string) => EngineMode
) {
    const committedDbNames = ref<Set<string>>(new Set())

    const shouldReset = (_sql: string, dbName: string): boolean => {
        return !(dbName && committedDbNames.value.has(dbName))
    }

    const submitNow = () => {
        const dbName = activeTab.value.dbName
        if (!dbName) return
        committedDbNames.value = new Set([...committedDbNames.value, dbName])
        mode.value = transitionFn(mode.value, 'user', 'submitNow')
        void executeSqlRemote(true)
    }

    const deleteDb = (dbName: string) => {
        committedDbNames.value = new Set(committedDbNames.value)
        committedDbNames.value.delete(dbName)
        for (const t of tabs.value) {
            if (t.dbName === dbName) setTabDbName(t.id, '')
        }
    }

    const dbList = computed(() => {
        const list = Array.from(committedDbNames.value)
        list.sort()
        return list
    })

    return {committedDbNames, shouldReset, submitNow, deleteDb, dbList}
}
