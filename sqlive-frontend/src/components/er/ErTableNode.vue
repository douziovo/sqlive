<template>
  <div
    class="er-table-node"
    :class="{
      'opacity-30 pointer-events-none': data.isFiltered,
      'er-table-node-match': data.isMatchHighlight,
      'er-table-node-active': data.isActiveMatch,
    }"
    @dblclick="handleDoubleClick"
  >
    <div class="er-table-header">
      <span class="er-table-name">{{ data.tableName }}</span>
    </div>

    <div class="er-column-list">
      <div
        v-for="(col, index) in data.columns"
        :key="col.name"
        class="er-column-row"
        :class="{ 'bg-muted': index % 2 === 1 }"
      >
        <Handle
          v-if="col.isForeignKey"
          type="source"
          :id="`col-source-${col.name}`"
          :position="Position.Right"
          class="er-handle er-handle-source"
        />

        <span class="er-badge-slot">
          <span v-if="col.isPrimaryKey" class="er-badge er-badge-pk">主键</span>
          <span v-else-if="col.isForeignKey" class="er-badge er-badge-fk">外键</span>
          <span v-else-if="col.isUnique" class="er-badge er-badge-uq">唯一</span>
        </span>

        <span class="er-column-text">
          <span class="er-column-name">{{ col.name }}</span><!--
       --><span class="er-column-sep">:</span><!--
       --><span class="er-column-type">{{ col.type }}</span>
        </span>

        <Handle
          v-if="col.isPrimaryKey"
          type="target"
          :id="`col-target-${col.name}`"
          :position="Position.Left"
          class="er-handle er-handle-target"
        />
      </div>
    </div>

    <Handle
      type="target"
      id="target-default"
      :position="Position.Left"
      class="er-handle-default"
    />
    <Handle
      type="source"
      id="source-default"
      :position="Position.Right"
      class="er-handle-default"
    />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { ErTableNodeData } from '@/model/DatabaseTypes'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object as () => ErTableNodeData, required: true },
  selected: { type: Boolean, default: false },
  sourcePosition: { type: String as () => Position, default: Position.Right },
  targetPosition: { type: String as () => Position, default: Position.Left }
})

const emit = defineEmits<(e: 'navigate', tableName: string) => void>()

function handleDoubleClick() {
  emit('navigate', props.data.tableName)
}
</script>

<style scoped>
.er-table-node {
  background: white;
  border: 2px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  min-width: 200px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, 'Cascadia Code', 'Fira Code', monospace;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  cursor: pointer;
}
.er-table-node:hover {
  border-color: #60a5fa;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
}

.er-table-header {
  background: var(--primary);
  color: white;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
}

.er-column-list {
  padding: 2px 0;
}

.er-column-row {
  display: flex;
  align-items: center;
  padding: 3px 8px;
  position: relative;
  font-size: 12px;
  line-height: 1.6;
  transition: background 0.15s;
  gap: 4px;
}
.er-column-row:hover {
  background: color-mix(in srgb, var(--primary) 10%, transparent) !important;
}

.er-column-text {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.er-column-name {
  font-weight: 600;
  color: var(--foreground);
}

.er-column-sep {
  color: var(--muted-foreground);
  margin: 0 2px;
  font-weight: 400;
}

.er-column-type {
  color: var(--muted-foreground);
  font-size: 11px;
}

.er-badge-slot {
  display: inline-block;
  width: 32px;
  flex-shrink: 0;
  text-align: left;
}

.er-badge {
  display: inline-block;
  text-align: center;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 700;
  border-radius: 3px;
  flex-shrink: 0;
  line-height: 16px;
  letter-spacing: 0;
}
.er-badge-pk {
  background: #fef3c7;
  color: #b45309;
}
.er-badge-fk {
  background: #dbeafe;
  color: #1d4ed8;
}
.er-badge-uq {
  background: #ede9fe;
  color: #6d28d9;
}

.er-handle {
  width: 8px;
  height: 8px;
  border: 2px solid white;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 10;
}
.er-handle-source {
  background: var(--primary);
  right: -4px;
}
.er-handle-target {
  background: #f59e0b;
  left: -4px;
}
.er-column-row:hover .er-handle {
  opacity: 1;
}

.er-handle-default {
  opacity: 0;
  pointer-events: none;
}

.er-table-node-match {
  border: 2px solid #eab308;
  box-shadow: 0 0 6px rgba(234, 179, 8, 0.25);
  background: #fefce8;
}

.er-table-node-active {
  border: 2px solid #f97316;
  box-shadow: 0 0 10px rgba(249, 115, 22, 0.35), 0 2px 12px rgba(249, 115, 22, 0.2);
  background: #fff7ed;
  animation: er-match-pulse 0.3s ease-out;
}

@keyframes er-match-pulse {
  0% { box-shadow: 0 0 16px rgba(249, 115, 22, 0.5), 0 4px 20px rgba(249, 115, 22, 0.3); }
  100% { box-shadow: 0 0 10px rgba(249, 115, 22, 0.35), 0 2px 12px rgba(249, 115, 22, 0.2); }
}
</style>
