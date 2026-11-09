<script setup lang="ts">
import { X } from '@lucide/vue'
import { reactiveOmit } from '@vueuse/core'
import type { DialogContentEmits, DialogContentProps, PointerDownOutsideEvent } from 'reka-ui'
import {
    DialogClose,
    DialogContent,
    DialogOverlay,
    DialogPortal,
    useForwardPropsEmits
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/lib/utils'

defineOptions({
    inheritAttrs: false
})

const props = defineProps<DialogContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)

// 由模板内联 handler 抽出的命名函数（逻辑完全不变）：点击落在滚动内容可见区域之外时
// 阻止 pointer-down-outside 关闭对话框。抽成脚本函数也避免了 IDE 对内联多语句的误判。
function onPointerDownOutside(event: PointerDownOutsideEvent): void {
    const originalEvent = event.detail.originalEvent
    const target = originalEvent.target as HTMLElement
    if (originalEvent.offsetX > target.clientWidth || originalEvent.offsetY > target.clientHeight) {
        event.preventDefault()
    }
}
</script>

<template>
    <DialogPortal>
        <DialogOverlay
            class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
            <DialogContent
                :class="
                    cn(
                        'relative z-50 my-8 grid w-full max-w-lg gap-4 border border-border bg-background p-6 shadow-lg duration-200 sm:rounded-lg md:w-full',
                        props.class
                    )
                "
                v-bind="{ ...$attrs, ...forwarded }"
                @pointer-down-outside="onPointerDownOutside"
            >
                <slot />

                <DialogClose
                    class="absolute top-4 right-4 rounded-md p-0.5 transition-colors hover:bg-secondary"
                >
                    <X class="h-4 w-4" />
                    <span class="sr-only">Close</span>
                </DialogClose>
            </DialogContent>
        </DialogOverlay>
    </DialogPortal>
</template>
