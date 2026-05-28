<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toSqlLiteral } from '../utils/sql'
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

  let sql = `CREATE TABLE ${tableName.value}(\n`

  const validRows = rows.value.filter((r) => r.name && r.type)
  if (validRows.length === 0) return ''

  const defs = validRows.map((r) => `  ${r.name} ${r.type}`)
  sql += defs.join(',\n')
  sql += `\n);`

  const validValues = rows.value.filter((r) => r.name && r.value)
  if (validValues.length > 0) {
    sql += `\n\nINSERT INTO ${tableName.value} VALUES (`
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
  const columns = rows.value.map((r) => `${r.name} ${r.type}`)

  const rowData: any = {}
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
      <div class="px-6 py-4 border-b bg-muted flex justify-between items-center">
        <h3 class="text-xl font-semibold text-foreground">&#x1F6E0;&#xFE0F; 创建新表格</h3>
        <button @click="close" class="text-muted-foreground/70 hover:text-muted-foreground transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <div class="p-6 overflow-y-auto custom-scrollbar">
        <!-- 表格名称 -->
        <div class="mb-6 text-center">
          <label class="block text-sm font-semibold text-secondary-foreground mb-2 uppercase tracking-wide">表格名称</label>
          <input
              v-model="tableName"
              type="text"
              class="w-1/2 text-center text-lg font-semibold border-b-2 border-primary focus:outline-none focus:border-primary py-1 transition-colors placeholder-muted-foreground/50"
              placeholder="请输入表名 (如: users)"
          >
        </div>

        <div class="mb-6">
          <div class="grid grid-cols-[1fr_1fr_1fr_40px] gap-3 mb-2 text-sm font-semibold text-muted-foreground text-center items-end">
            <div class="pb-1 text-left pl-1">数据类型</div>
            <div class="pb-1 text-left pl-1">字段名</div>
            <div class="pb-1 text-left pl-1">初始值 (可选)</div>
            <div></div>
          </div>

          <div class="space-y-2">
            <div
                v-for="(row, index) in rows"
                :key="index"
                class="grid grid-cols-[1fr_1fr_1fr_40px] gap-3 items-center group"
            >
              <input
                  v-model="row.type"
                  class="border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-mono text-secondary-foreground shadow-sm"
                  placeholder="如: int"
              >

              <input
                  v-model="row.name"
                  class="border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-semibold text-foreground shadow-sm"
                  placeholder="如: id"
              >

              <input
                  v-model="row.value"
                  class="border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-muted-foreground bg-muted shadow-sm"
                  placeholder="空"
              >

              <button
                  @click="removeRow(index)"
                  class="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors border border-transparent hover:border-destructive/20"
                  title="删除此行"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            </div>

            <button
                @click="addRow"
                class="w-full py-2 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary/60 hover:text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-2 font-semibold mt-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              添加新字段
            </button>
          </div>
        </div>

        <div class="mb-2">
          <label class="block text-sm font-semibold text-secondary-foreground mb-2 text-center">SQL 预览</label>
          <div class="bg-muted border border-border rounded-lg p-4 font-mono text-sm text-foreground overflow-x-auto shadow-inner relative group min-h-[80px] flex items-center justify-center">
            <pre v-if="previewSql" class="whitespace-pre-wrap w-full text-left">{{ previewSql }}</pre>
            <span v-else class="text-muted-foreground/70 italic">等待输入...</span>
          </div>
        </div>
      </div>

      <div class="p-6 bg-muted border-t flex justify-end gap-3">
        <button
            @click="close"
            class="px-5 py-3 rounded-lg border border-border text-secondary-foreground hover:bg-secondary font-medium transition-colors"
        >
          取消
        </button>
        <button
            @click="submit"
            class="px-5 py-3 rounded-lg bg-primary text-white hover:bg-primary/90 shadow-lg hover:shadow-primary/30 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
