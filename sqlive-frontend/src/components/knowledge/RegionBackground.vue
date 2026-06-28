<template>
  <div class="region-background-layer" aria-hidden="true">
    <svg
      ref="svgRef"
      :style="svgStyle"
      :viewBox="`0 0 ${svgBounds.width} ${svgBounds.height}`"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g v-if="zoomLevel < 0.5" class="region-labels">
        <text
          v-for="region in regionsWithLabels"
          :key="'label-' + region.category"
          :x="region.centroid.x"
          :y="region.centroid.y"
          text-anchor="middle"
          dominant-baseline="middle"
          fill="#64748b"
          :font-size="labelFontSize"
          font-weight="600"
          font-family="Geist, sans-serif"
          :opacity="labelOpacity"
        >
          {{ region.displayName }} · {{ region.count }} 个知识点
        </text>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import type { Node } from '@vue-flow/core'
import type { KnowledgeNodeData } from '@/composables/useKnowledgeGraph'
import { computeHull, type Point } from '@/composables/useConcaveHull'

interface SvgBounds {
  minX: number
  minY: number
  width: number
  height: number
}

const props = defineProps<{
  positionedNodes: Node<KnowledgeNodeData>[]
  svgBounds: SvgBounds
  concavity?: number
}>()

const zoomLevel = inject<number>('zoomLevel', 1)
const svgTransform = inject<string>('svgTransform', '')

const labelFontSize = computed(() => 16 / Math.max(0.1, zoomLevel.value))

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  basics: '基础查询',
  query: '查询进阶',
  ddl: '表结构定义',
  dml: '数据操作',
  advanced: '高级特性',
  performance: '性能优化'
}

const svgRef = ref<SVGSVGElement | null>(null)

const svgStyle = computed(() => ({
  position: 'absolute' as const,
  left: '0px',
  top: '0px',
  width: `${props.svgBounds.width}px`,
  height: `${props.svgBounds.height}px`,
  transform: svgTransform.value,
  transformOrigin: '0 0'
}))

const labelOpacity = computed(() => {
  return Math.max(0, Math.min(0.7, (0.5 - zoomLevel.value) / 0.2 * 0.7))
})

interface RegionPolygon {
  category: string
  centroid: { x: number; y: number }
  count: number
}

const regions = computed<RegionPolygon[]>(() => {
  const groups = new Map<string, Point[]>()
  for (const node of props.positionedNodes) {
    const category = (node.data as KnowledgeNodeData).category || '__uncategorized__'
    if (!groups.has(category)) groups.set(category, [])
    groups.get(category)!.push({
      x: node.position.x + 60 - props.svgBounds.minX,
      y: node.position.y + 22 - props.svgBounds.minY
    })
  }

  const result: RegionPolygon[] = []
  for (const [category, points] of groups) {
    if (points.length === 0) continue
    const hull = computeHull(points, { margin: 60, concavity: props.concavity })
    result.push({
      category,
      centroid: hull.centroid,
      count: points.length
    })
  }
  return result
})

const regionsWithLabels = computed(() => {
  return regions.value.map((region) => ({
    ...region,
    displayName: CATEGORY_DISPLAY_NAMES[region.category] || region.category
  }))
})
</script>

<style scoped>
.region-background-layer {
  pointer-events: none;
}

.region-background-layer svg {
  display: block;
  overflow: visible;
}
</style>
