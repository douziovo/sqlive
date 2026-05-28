<template>
  <div
    class="fixed z-50 flex flex-col bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
    :style="panelStyle"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between px-4 py-2 border-b border-border cursor-move select-none flex-shrink-0"
      @mousedown="onDragStart"
    >
      <span class="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <span class="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-[10px] text-white">AI</span>
        SQL 助手
      </span>
      <div class="flex items-center gap-1">
        <button @click="emit('clear')" class="text-xs text-muted-foreground/70 hover:text-muted-foreground px-2 py-1 rounded-lg hover:bg-secondary cursor-pointer transition-colors" title="清空对话">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>
        </button>
        <button data-testid="ai-chat-close" @click="emit('close')" class="text-xs text-muted-foreground/70 hover:text-muted-foreground px-2 py-1 rounded-lg hover:bg-secondary cursor-pointer transition-colors" title="关闭">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>

    <!-- Messages -->
    <Conversation class="flex-1 min-h-0 bg-muted/50" :anchor="'none'">
      <ConversationContent>
        <ConversationEmptyState
          v-if="messages.length === 0"
          title="SQL 学习助手"
          description="我可以帮你解释、优化和生成 SQL"
        >
          <template #icon>
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-2xl shadow-lg shadow-primary/20">🤖</div>
          </template>
          <template #default>
            <div class="w-full max-w-xs space-y-2 mt-4">
              <Suggestion
                v-for="p in prompts" :key="p" :suggestion="p" variant="outline"
                class="w-full justify-start text-sm font-normal text-muted-foreground border-border hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors rounded-xl"
                @click="emit('send', p)"
              >{{ p }}</Suggestion>
            </div>
          </template>
        </ConversationEmptyState>

        <div v-for="(msg, idx) in messages" :key="msg.id">
          <div v-if="msg.role === 'system'" class="w-full bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-2 text-xs text-destructive">
            ⚠️ {{ msg.content }}
          </div>

          <div v-else class="group/row mb-5">
            <!-- User message -->
            <div v-if="msg.role === 'user'">
              <!-- Inline edit mode: full width, expands to the left -->
              <div v-if="editingMsg?.id === msg.id" class="flex flex-col gap-2">
                <textarea
                  v-model="editText"
                  class="text-sm bg-card border border-border rounded-lg px-3 py-2 outline-none focus:border-border focus:ring-2 focus:ring-ring w-full min-h-[40px]"
                  rows="1"
                  @input="autoResizeEdit"
                  @keydown.enter.exact.prevent="submitEdit"
                  @keydown.escape="cancelEdit"
                ></textarea>
                <div class="flex items-center gap-2 justify-end">
                  <button @click="cancelEdit" class="px-2 py-1 text-[11px] bg-secondary text-secondary-foreground hover:text-secondary-foreground hover:bg-secondary rounded-lg transition-colors">取消</button>
                  <button @click="submitEdit" class="px-2 py-1 text-[11px] font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">更新</button>
                </div>
              </div>
              <!-- Display mode: right-aligned with bubble -->
              <div v-else class="flex justify-end">
                <div class="max-w-[85%]">
                  <div class="text-foreground text-sm whitespace-pre-wrap break-words bg-secondary rounded-2xl px-3 py-2">{{ msg.content }}</div>
                  <div v-if="!msg.isStreaming" :class="['flex items-center gap-1 mt-1 justify-end', idx === messages.length - 1 ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100']">
                    <button @click="startEdit(msg)" class="p-1.5 rounded-lg text-muted-foreground/70 hover:text-muted-foreground hover:bg-secondary transition-colors" title="编辑">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button @click="emit('delete', msg.id)" class="p-1.5 rounded-lg text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors" title="删除">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Assistant message: left-aligned -->
            <div v-else class="flex">
              <div class="flex-1 min-w-0">
                <Reasoning v-if="(msg.reasoning || msg.isReasoning)" :is-streaming="msg.isReasoning || false" :default-open="false" class="mb-2">
                  <ReasoningTrigger :reasoning="msg.reasoning || ''" />
                  <ReasoningContent :content="msg.reasoning || ''" />
                </Reasoning>
                <div v-if="msg.isStreaming && !msg.content && !msg.isReasoning" class="flex items-center gap-2 text-muted-foreground/70 py-1">
                  <Loader class="size-3.5" /><span class="text-sm">Thinking...</span>
                </div>
                <!-- Markdown rendered with marked -->
                <div
                  v-if="msg.content"
                  class="md-body text-sm text-foreground leading-relaxed w-full overflow-hidden"
                  v-html="renderMd(msg.content)"
                />
                <div v-if="msg.content && !msg.isStreaming"
                  :class="['flex items-center gap-1 mt-1 -ml-1 transition-opacity duration-150', idx === messages.length - 1 ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100']"
                >
                  <button @click="emit('regenerate', msg.id)" class="p-1.5 rounded-lg text-muted-foreground/70 hover:text-muted-foreground hover:bg-secondary transition-colors" title="重新回答">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
                  </button>
                  <button @click="copyMessage(msg.content)" class="p-1.5 rounded-lg text-muted-foreground/70 hover:text-muted-foreground hover:bg-secondary transition-colors" :title="copiedId === msg.id ? '已复制' : '复制'">
                    <svg v-if="copiedId !== msg.id" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    <svg v-else class="w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  <button @click="emit('delete', msg.id)" class="p-1.5 rounded-lg text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors" title="删除">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
                <AiMessageFooter
                  v-if="idx === messages.length - 1 && !msg.isStreaming && msg.content"
                  :start-time="msg.timestamp"
                  :first-token-time="msg.firstTokenTime"
                  :end-time="msg.endTime"
                  :usage="msg.metadata?.usage"
                />
              </div>
            </div>
          </div>
        </div>
        <div v-if="messages.length > 0" />
      </ConversationContent>
    </Conversation>

    <!-- Input -->
    <div class="px-4 py-2 border-t border-border flex-shrink-0 bg-card">
      <div class="relative flex items-end bg-muted rounded-2xl border border-border focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 pl-4 pr-12 py-2 transition-colors transition-shadow">
        <textarea v-model="inputText" ref="inputRef" class="flex-1 resize-none bg-transparent text-sm text-foreground placeholder-muted-foreground/70 outline-none min-h-[20px] max-h-[120px] py-0" placeholder="输入消息..." rows="1" :disabled="isLoading" @keydown.enter.exact.prevent="send" @keydown.escape="emit('close')" @input="autoResize"></textarea>
        <!-- Stop button -->
        <button v-if="isLoading" @click="emit('cancelStream')" class="absolute right-0 bottom-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center cursor-pointer group" title="停止生成">
          <svg class="w-3 h-3 text-muted-foreground group-hover:text-destructive transition-colors" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
        </button>
        <!-- Send button -->
        <button v-else @click="send()" :disabled="!inputText.trim()" class="absolute right-0 bottom-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer" :class="!inputText.trim() ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    </div>

    <div class="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10" @mousedown.stop="onResizeStart">
      <svg class="absolute bottom-1 right-1 w-3 h-3 text-muted-foreground/50" viewBox="0 0 12 12"><path d="M11 1L1 11M11 5L5 11M11 9L9 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useEventListener } from '@vueuse/core';
import { marked } from 'marked';
import { Conversation, ConversationContent, ConversationEmptyState } from '@/components/ai-elements/conversation';
import AiMessageFooter from '@/components/AiMessageFooter.vue';
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning';
import { Suggestion } from '@/components/ai-elements/suggestion';
import { Loader } from '@/components/ai-elements/loader';
import type { AiMessage } from '../composables/useAiChat';

const props = defineProps<{
  messages: AiMessage[];
  isLoading: boolean;
}>();

const emit = defineEmits<{
  send: [text: string]; close: []; clear: []; cancelStream: [];
  regenerate: [messageId: string]; edit: [messageId: string, newText: string]; delete: [messageId: string];
}>();

const inputText = ref('');
const inputRef = ref<HTMLTextAreaElement | null>(null);
const copiedId = ref<string | null>(null);
const copyTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
const editingMsg = ref<AiMessage | null>(null);
const editText = ref('');

function getEditTextarea(): HTMLTextAreaElement | null {
  return document.querySelector('.fixed.z-50 textarea:not([placeholder="输入消息..."])') as HTMLTextAreaElement | null;
}
const prompts = ['解释当前代码', '如何优化我的查询？', 'LEFT JOIN 和 INNER JOIN 的区别', '什么是子查询？'];

async function copyMessage(text: string) {
  try { await navigator.clipboard.writeText(text); } catch { /* fallback */ }
  const msg = props.messages.find(m => m.content === text);
  if (msg) {
    copiedId.value = msg.id;
    copyTimeout.value = setTimeout(() => { copiedId.value = null; }, 2000);
  }
}
function startEdit(msg: AiMessage) { editingMsg.value = msg; editText.value = msg.content; }

watch(editingMsg, (val) => {
  if (!val) return;
  nextTick(() => {
    const el = getEditTextarea();
    if (!el) return;
    autoResizeEdit();
    el.focus();
    el.setSelectionRange(0, 0);
    const container = el.closest('[style*="overflow"]') as HTMLElement;
    if (container) {
      let offsetTop = 0;
      let cur: HTMLElement | null = el;
      while (cur && cur !== container) { offsetTop += cur.offsetTop; cur = cur.offsetParent as HTMLElement | null; }
      // Simulate a wheel-up to unstick StickToBottom BEFORE setting scrollTop
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true }));
      container.scrollTop = Math.max(0, offsetTop - 60);
    }
  });
});

// Auto-scroll to bottom when messages change (except when editing)
watch(() => props.messages.length, () => {
  if (editingMsg.value) return;
  nextTick(() => {
    const container = document.querySelector('.fixed.z-50 [style*="overflow"]') as HTMLElement;
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  });
});

function submitEdit() { if (editingMsg.value && editText.value.trim()) { emit('edit', editingMsg.value.id, editText.value.trim()); editingMsg.value = null; editText.value = ''; } }
function cancelEdit() { editingMsg.value = null; editText.value = ''; }

function renderMd(text: string): string {
  if (!text) return '';
  return marked.parse(text, { breaks: true, gfm: true }) as string;
}

// ── Panel position & size ──────────────────────────────────────
const panelState = reactive({ x: 0, y: 0, width: 500, height: 580, initialized: false });
function initPosition() { if (panelState.initialized) return; panelState.x = Math.round(window.innerWidth * 0.38); panelState.y = 40; panelState.initialized = true; }
const panelStyle = computed(() => ({ left: panelState.x + 'px', top: panelState.y + 'px', width: panelState.width + 'px', height: panelState.height + 'px' }));

// ── Drag ───────────────────────────────────────────────────────
const isDragging = ref(false);
const dragStartPos = reactive({ x: 0, y: 0, panelX: 0, panelY: 0 });
function onDragStart(e: MouseEvent) { e.preventDefault(); isDragging.value = true; dragStartPos.x = e.clientX; dragStartPos.y = e.clientY; dragStartPos.panelX = panelState.x; dragStartPos.panelY = panelState.y; document.body.style.cursor = 'move'; document.body.style.userSelect = 'none'; }
function onDragMove(e: MouseEvent) { if (!isDragging.value) return; const dx = e.clientX - dragStartPos.x, dy = e.clientY - dragStartPos.y; panelState.x = Math.max(0, Math.min(window.innerWidth - panelState.width, dragStartPos.panelX + dx)); panelState.y = Math.max(0, Math.min(window.innerHeight - 40, dragStartPos.panelY + dy)); }
function onDragEnd() { isDragging.value = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; }
useEventListener(document, 'mousemove', onDragMove);
useEventListener(document, 'mouseup', onDragEnd);

// ── Resize ─────────────────────────────────────────────────────
const MIN_W = 340, MIN_H = 320;
const isResizing = ref(false);
const resizeStartPos = reactive({ x: 0, y: 0, w: 0, h: 0 });
function onResizeStart(e: MouseEvent) { e.preventDefault(); isResizing.value = true; resizeStartPos.x = e.clientX; resizeStartPos.y = e.clientY; resizeStartPos.w = panelState.width; resizeStartPos.h = panelState.height; document.body.style.cursor = 'nwse-resize'; document.body.style.userSelect = 'none'; }
function onResizeMove(e: MouseEvent) { if (!isResizing.value) return; const dx = e.clientX - resizeStartPos.x, dy = e.clientY - resizeStartPos.y; panelState.width = Math.max(MIN_W, Math.min(window.innerWidth - panelState.x, resizeStartPos.w + dx)); panelState.height = Math.max(MIN_H, Math.min(window.innerHeight - panelState.y, resizeStartPos.h + dy)); }
function onResizeEnd() { isResizing.value = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; }
useEventListener(document, 'mousemove', onResizeMove);
useEventListener(document, 'mouseup', onResizeEnd);

onMounted(() => { initPosition(); });
onUnmounted(() => { if (copyTimeout.value) clearTimeout(copyTimeout.value); });
function send(e?: KeyboardEvent) { if (e?.isComposing) return; const t = inputText.value.trim(); if (!t || props.isLoading) return; emit('send', t); inputText.value = ''; nextTick(() => { if (inputRef.value) inputRef.value.style.height = 'auto'; }); }
function autoResize() { const el = inputRef.value; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }
function autoResizeEdit() { const el = getEditTextarea(); if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 300) + 'px'; }
</script>

<style>
/* Markdown body — marked output */
.md-body { word-break: break-word; }
.md-body h1 { font-size: 0.95rem; font-weight: 700; margin: 0.8em 0 0.4em; }
.md-body h2 { font-size: 0.88rem; font-weight: 600; margin: 0.7em 0 0.3em; }
.md-body h3 { font-size: 0.85rem; font-weight: 600; margin: 0.6em 0 0.25em; }
.md-body h4 { font-size: 0.8rem; font-weight: 600; margin: 0.5em 0 0.2em; }
.md-body p { margin: 0.5em 0; }
.md-body p:first-child { margin-top: 0; }
.md-body p:last-child { margin-bottom: 0; }
.md-body ul, .md-body ol { padding-left: 1.5em; margin: 0.5em 0; }
.md-body li { margin: 0.15em 0; }
.md-body pre {
  background: #f8fafc; color: #334155; border: 1px solid #e2e8f0;
  padding: 0.75rem 1rem; border-radius: 0.5rem;
  overflow-x: auto; max-width: 100%;
  margin: 0.6em 0; font-size: 0.8rem; line-height: 1.5;
  white-space: pre-wrap;
}
.md-body code {
  font-family: var(--font-mono);
  font-size: 0.8em;
}
.md-body :not(pre) > code {
  background: var(--muted); color: var(--foreground);
  padding: 0.1em 0.35em; border-radius: 0.25rem;
}
.md-body table {
  width: 100%; border-collapse: collapse; margin: 0.6em 0;
  display: block; overflow-x: auto; max-width: 100%;
}
.md-body th, .md-body td {
  border: 1px solid #d1d5db; padding: 0.4rem 0.6rem;
  text-align: left; font-size: 0.75rem;
}
.md-body th { background: #f3f4f6; font-weight: 600; }
.md-body blockquote {
  border-left: 3px solid #d1d5db; padding-left: 1em;
  margin: 0.5em 0; color: #6b7280;
}
.md-body hr { border: none; border-top: 1px solid #e5e7eb; margin: 1em 0; }
.md-body img { max-width: 100%; border-radius: 0.5rem; }
.md-body a { color: #2563eb; text-decoration: underline; }
.md-body strong { font-weight: 600; }
</style>
