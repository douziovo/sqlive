/**
 * useGraphLOD — Level-of-detail helper for the knowledge graph.
 *
 * Pure-function module that maps a zoom level to an edge opacity.
 * Node-level label opacity stays in `KnowledgeNode.vue` (D-10 scope
 * excludes it from this composable).
 */
export function useGraphLOD() {
  /**
   * Edge opacity as a function of zoom. Five tiers:
   *   zoom < 0.3          → 0     (hidden)
   *   0.3 ≤ zoom < 0.5    → ramp  0 → 0.12
   *   0.5 ≤ zoom < 1.2    → 0.12  (compact tier)
   *   1.2 ≤ zoom < 1.5    → ramp  0.12 → 0.18
   *   zoom ≥ 1.5          → 0.18  (detail tier)
   */
  function edgeOpacityForZoom(zoom: number): number {
    if (zoom < 0.3) return 0
    if (zoom < 0.5) return ((zoom - 0.3) / 0.2) * 0.12
    if (zoom < 1.2) return 0.12
    if (zoom < 1.5) return 0.12 + ((zoom - 1.2) / 0.3) * 0.06
    return 0.18
  }

  return { edgeOpacityForZoom }
}
