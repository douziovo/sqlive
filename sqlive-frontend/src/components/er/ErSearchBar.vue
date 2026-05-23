<template>
  <Transition name="findbar-slide">
    <div v-if="visible" class="er-findbar">
      <div class="er-findbar-input-wrap">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref="inputRef"
          :value="modelValue"
          type="text"
          placeholder="搜索表名或列名..."
          class="er-findbar-input"
          @input="onInput"
          @keydown.escape="onClose"
          @keydown.enter="onEnter"
        />
        <span v-if="modelValue" class="er-findbar-count">
          {{ filterCountText }}
        </span>
        <button
          class="er-findbar-nav-btn"
          title="上一个匹配"
          @click="onPrev"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          class="er-findbar-nav-btn"
          title="下一个匹配"
          @click="onNext"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          class="er-findbar-close-btn"
          title="关闭 (Esc)"
          @click="onClose"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useDebounceFn } from '@vueuse/core';

const props = defineProps<{
  modelValue: string;
  visible: boolean;
  totalCount: number;
  matchCount: number;
  currentIndex: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'close'): void;
  (e: 'prev'): void;
  (e: 'next'): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);

const debouncedEmit = useDebounceFn((value: string) => {
  emit('update:modelValue', value);
}, 150);

const filterCountText = ref('');

watch([() => props.matchCount, () => props.currentIndex], ([mc, ci]) => {
  if (mc > 0 && props.modelValue) {
    filterCountText.value = ci >= 0 ? `${ci + 1}/${mc}` : `${mc}/${props.totalCount}`;
  } else {
    filterCountText.value = '';
  }
});

watch(() => props.visible, async (v) => {
  if (v) {
    await nextTick();
    inputRef.value?.focus();
    inputRef.value?.select();
  }
});

function onInput(e: Event) {
  debouncedEmit((e.target as HTMLInputElement).value);
}

function onClose() {
  emit('update:modelValue', '');
  emit('close');
}

function onEnter(e: KeyboardEvent) {
  if (e.shiftKey) {
    emit('prev');
  } else {
    emit('next');
  }
}

function onPrev() {
  emit('prev');
}

function onNext() {
  emit('next');
}
</script>

<style scoped>
.er-findbar {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 20;
}

.er-findbar-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 2px 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  min-width: 280px;
}

.er-findbar-input {
  border: none;
  outline: none;
  font-size: 12px;
  color: #1e293b;
  background: transparent;
  width: 100%;
  padding: 4px 2px;
}

.er-findbar-input::placeholder {
  color: #94a3b8;
}

.er-findbar-count {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 30px;
  text-align: center;
}

.er-findbar-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.1s;
}

.er-findbar-nav-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.er-findbar-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.1s;
}

.er-findbar-close-btn:hover {
  background: #fef2f2;
  color: #ef4444;
}

.findbar-slide-enter-active,
.findbar-slide-leave-active {
  transition: all 0.2s ease;
}

.findbar-slide-enter-from,
.findbar-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
