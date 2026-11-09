<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { toSqlLiteral } from '../utils/sql'
import { quoteSqlIdentifier } from '../utils/sqlIdentifiers'
import { Dialog, DialogContent } from './ui/dialog'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits(['update:open', 'submit'])

const tableName = ref('')
const rows = ref([{ type: '', name: '', value: '' }])

watch(
    () => props.open,
    (newVal) => {
        if (newVal) {
            tableName.value = ''
            rows.value = [{ type: '', name: '', value: '' }]
        }
    }
)

const addRow = () => {
    rows.value.push({ type: '', name: '', value: '' })
}

const removeRow = (index: number) => {
    rows.value.splice(index, 1)
}

const isValid = computed(() => {
    if (tableName.value.trim() === '') return false
    return rows.value.length > 0 && rows.value.every((r) => r.name.trim() && r.type.trim())
})

const previewSql = computed(() => {
    if (!tableName.value) return ''

    let sql = `CREATE TABLE ${quoteSqlIdentifier(tableName.value)}(\n`

    const validRows = rows.value.filter((r) => r.name && r.type)
    if (validRows.length === 0) return ''

    const defs = validRows.map((r) => `  ${quoteSqlIdentifier(r.name)} ${r.type}`)
    sql += defs.join(',\n')
    sql += `\n);`

    const validValues = rows.value.filter((r) => r.name && r.value)
    if (validValues.length > 0) {
        sql += `\n\nINSERT INTO ${quoteSqlIdentifier(tableName.value)} VALUES (`
        const vals = rows.value.map((r) => {
            const v = r.value.trim()
            if (!v) return 'NULL'
            return toSqlLiteral(v, r.type)
        })
        sql += vals.join(', ')
        sql += `);`
    }

    return sql
})

const close = () => {
    emit('update:open', false)
}

const submit = () => {
    const columns = rows.value.map((r) => `${quoteSqlIdentifier(r.name)} ${r.type}`)

    const rowData: Record<string, string> = {}
    rows.value.forEach((r) => {
        if (r.name) rowData[r.name] = r.value
    })

    emit('submit', {
        name: tableName.value,
        columns: columns,
        data: [rowData]
    })

    close()
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent>
            <!-- 顶部标题 -->
            <div class="flex items-center justify-between border-b bg-muted px-6 py-4">
                <h3 class="text-xl font-semibold text-foreground">&#x1F6E0;&#xFE0F; 创建新表格</h3>
                <button
                    @click="close"
                    class="text-muted-foreground/70 transition-colors hover:text-muted-foreground"
                >
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                        ></path>
                    </svg>
                </button>
            </div>

            <div class="custom-scrollbar overflow-y-auto p-6">
                <!-- 表格名称 -->
                <div class="mb-6 text-center">
                    <label
                        class="mb-2 block text-sm font-semibold tracking-wide text-secondary-foreground uppercase"
                        >表格名称</label
                    >
                    <input
                        v-model="tableName"
                        type="text"
                        class="w-1/2 border-b-2 border-primary py-1 text-center text-lg font-semibold placeholder-muted-foreground/50 transition-colors focus:border-primary focus:outline-none"
                        placeholder="请输入表名 (如: users)"
                    />
                </div>

                <div class="mb-6">
                    <div
                        class="mb-2 grid grid-cols-[1fr_1fr_1fr_40px] items-end gap-3 text-center text-sm font-semibold text-muted-foreground"
                    >
                        <div class="pb-1 pl-1 text-left">数据类型</div>
                        <div class="pb-1 pl-1 text-left">字段名</div>
                        <div class="pb-1 pl-1 text-left">初始值 (可选)</div>
                        <div></div>
                    </div>

                    <div class="space-y-2">
                        <div
                            v-for="(row, index) in rows"
                            :key="index"
                            class="group grid grid-cols-[1fr_1fr_1fr_40px] items-center gap-3"
                        >
                            <input
                                v-model="row.type"
                                class="rounded border px-3 py-2 font-mono text-sm text-secondary-foreground shadow-sm outline-none focus:ring-2 focus:ring-primary"
                                placeholder="如: int"
                            />

                            <input
                                v-model="row.name"
                                class="rounded border px-3 py-2 text-sm font-semibold text-foreground shadow-sm outline-none focus:ring-2 focus:ring-primary"
                                placeholder="如: id"
                            />

                            <input
                                v-model="row.value"
                                class="rounded border bg-muted px-3 py-2 text-sm text-muted-foreground shadow-sm outline-none focus:ring-2 focus:ring-primary"
                                placeholder="空"
                            />

                            <button
                                @click="removeRow(index)"
                                class="flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted-foreground/70 transition-colors hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                                title="删除此行"
                            >
                                <svg
                                    class="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    ></path>
                                </svg>
                            </button>
                        </div>

                        <button
                            @click="addRow"
                            class="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-2 font-semibold text-muted-foreground transition-colors hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
                        >
                            <svg
                                class="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M12 4v16m8-8H4"
                                ></path>
                            </svg>
                            添加新字段
                        </button>
                    </div>
                </div>

                <div class="mb-2">
                    <label
                        class="mb-2 block text-center text-sm font-semibold text-secondary-foreground"
                        >SQL 预览</label
                    >
                    <div
                        class="group relative flex min-h-[80px] items-center justify-center overflow-x-auto rounded-lg border border-border bg-muted p-4 font-mono text-sm text-foreground shadow-inner"
                    >
                        <pre v-if="previewSql" class="w-full text-left whitespace-pre-wrap">{{
                            previewSql
                        }}</pre>
                        <span v-else class="text-muted-foreground/70 italic">等待输入...</span>
                    </div>
                </div>
            </div>

            <div class="flex justify-end gap-3 border-t bg-muted p-6">
                <button
                    @click="close"
                    class="rounded-lg border border-border px-5 py-3 font-medium text-secondary-foreground transition-colors hover:bg-secondary"
                >
                    取消
                </button>
                <button
                    @click="submit"
                    class="rounded-lg bg-primary px-5 py-3 font-medium text-white shadow-lg transition-colors hover:bg-primary/90 hover:shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="!isValid"
                >
                    立即创建
                </button>
            </div>
        </DialogContent>
    </Dialog>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 3px;
}
</style>
