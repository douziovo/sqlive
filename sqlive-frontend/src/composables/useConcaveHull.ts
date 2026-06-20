/**
 * Point in 2D space.
 */
export interface Point {
  x: number
  y: number
}

/**
 * Options for hull computation.
 */
export interface HullOptions {
  /** Margin to expand the hull outward from the convex hull boundary (default 60). */
  margin?: number
  /** Reserved parameter for future concave hull support. */
  concavity?: number
}

/**
 * Bounding box of the hull.
 */
export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Result of hull computation.
 */
export interface HullResult {
  /** SVG path `d` attribute string. */
  pathD: string
  /** Centroid of the expanded polygon. */
  centroid: Point
  /** Bounding box of the expanded polygon. */
  bounds: Bounds
}

/**
 * Cross product of vectors AB and AC.
 * Returns > 0 for counter-clockwise (left turn), < 0 for clockwise (right turn), = 0 for collinear.
 */
export function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

/**
 * Compute convex hull of a set of 2D points using Andrew's monotone chain algorithm.
 * Returns vertices in counter-clockwise order (no duplicate start/end).
 * O(n log n) time complexity.
 */
export function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return [...points]

  // Sort by x, then by y
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)

  // Build lower hull
  const lower: Point[] = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop()
    }
    lower.push(p)
  }

  // Build upper hull
  const upper: Point[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop()
    }
    upper.push(p)
  }

  // Remove duplicate start/end points
  lower.pop()
  upper.pop()

  return [...lower, ...upper]
}

/**
 * Normalize a 2D vector. Returns {x: 0, y: 0} for zero-length vectors.
 */
function normalize(dx: number, dy: number): Point {
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1e-10) return { x: 0, y: 0 }
  return { x: dx / len, y: dy / len }
}

/**
 * Expand a convex hull polygon outward by a given margin.
 * Each vertex is pushed outward along the bisector of its two adjacent edges.
 * The hull is assumed to be in counter-clockwise order.
 */
export function expandHull(hull: Point[], margin: number): Point[] {
  if (hull.length < 3 || margin <= 0) return [...hull]

  const n = hull.length
  const result: Point[] = []

  for (let i = 0; i < n; i++) {
    const prev = hull[(i - 1 + n) % n]
    const curr = hull[i]
    const next = hull[(i + 1) % n]

    // Edge directions
    const inDx = curr.x - prev.x
    const inDy = curr.y - prev.y
    const outDx = next.x - curr.x
    const outDy = next.y - curr.y

    // Right normals (point outward for CCW polygon)
    const inNx = inDy   // right normal of incoming edge
    const inNy = -inDx
    const outNx = outDy  // right normal of outgoing edge
    const outNy = -outDx

    // Normalize and average the two outward normals
    const inNorm = normalize(inNx, inNy)
    const outNorm = normalize(outNx, outNy)

    const bisectorX = inNorm.x + outNorm.x
    const bisectorY = inNorm.y + outNorm.y
    const bisector = normalize(bisectorX, bisectorY)

    // Push outward
    result.push({
      x: curr.x + bisector.x * margin,
      y: curr.y + bisector.y * margin
    })
  }

  return result
}

/**
 * Generate an approximate circle path around a single point.
 * Uses 12 line segments to approximate a circle.
 */
function circlePath(center: Point, radius: number, segments: number = 12): Point[] {
  const points: Point[] = []
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    })
  }
  return points
}

/**
 * Generate a blob path encompassing 2 points with margin padding.
 * Creates an oval-like shape around the two points.
 */
function twoPointBlob(p1: Point, p2: Point, margin: number): Point[] {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  // Perpendicular direction
  const perpX = dist > 0 ? -dy / dist : 0
  const perpY = dist > 0 ? dx / dist : 1

  // Half-height of the blob
  const halfH = margin

  // If points are very close, treat as a single circle
  if (dist < 1) {
    const midX = (p1.x + p2.x) / 2
    const midY = (p1.y + p2.y) / 2
    return circlePath({ x: midX, y: midY }, margin)
  }

  // Create 4 corner points forming a rounded rectangle around the two points
  const startX = p1.x - (dx / dist) * margin
  const startY = p1.y - (dy / dist) * margin
  const endX = p2.x + (dx / dist) * margin
  const endY = p2.y + (dy / dist) * margin

  // Generate the blob as a polygon with additional edge segments for roundness
  // Use 16 segments total
  const points: Point[] = []
  const seg = 8

  // Top edge (end to start along the perpendicular positive direction)
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    points.push({
      x: endX + t * (startX - endX) + perpX * halfH * Math.sin(t * Math.PI),
      y: endY + t * (startY - endY) + perpY * halfH * Math.sin(t * Math.PI)
    })
  }

  // Bottom edge (start to end along the perpendicular negative direction)
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    points.push({
      x: startX + t * (endX - startX) - perpX * halfH * Math.sin(t * Math.PI),
      y: startY + t * (endY - startY) - perpY * halfH * Math.sin(t * Math.PI)
    })
  }

  return points
}

/**
 * Generate an SVG path `d` string from polygon vertices.
 */
export function toSvgPathD(vertices: Point[]): string {
  if (vertices.length === 0) return ''
  const parts = vertices.map((v, i) => {
    const prefix = i === 0 ? 'M' : 'L'
    return `${prefix}${v.x.toFixed(2)},${v.y.toFixed(2)}`
  })
  return parts.join(' ') + ' Z'
}

/**
 * Compute polygon area using the shoelace formula.
 * Returns absolute area.
 */
export function polygonArea(vertices: Point[]): number {
  if (vertices.length < 3) return 0
  let area = 0
  const n = vertices.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += vertices[i].x * vertices[j].y
    area -= vertices[j].x * vertices[i].y
  }
  return Math.abs(area) / 2
}

/**
 * Compute the centroid of a polygon using area-weighted formula.
 * For degenerate (zero-area) polygons, returns the arithmetic mean of vertices.
 * For empty vertex arrays, returns { x: 0, y: 0 }.
 */
export function polygonCentroid(vertices: Point[]): Point {
  if (vertices.length === 0) return { x: 0, y: 0 }

  const n = vertices.length
  if (n < 3) {
    // For 1-2 points, return their arithmetic mean
    const sumX = vertices.reduce((s, v) => s + v.x, 0)
    const sumY = vertices.reduce((s, v) => s + v.y, 0)
    return { x: sumX / n, y: sumY / n }
  }

  let cx = 0
  let cy = 0
  let signedArea = 0

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const cross = vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y
    signedArea += cross
    cx += (vertices[i].x + vertices[j].x) * cross
    cy += (vertices[i].y + vertices[j].y) * cross
  }

  // Handle degenerate (zero area) case
  if (Math.abs(signedArea) < 1e-10) {
    const sumX = vertices.reduce((s, v) => s + v.x, 0)
    const sumY = vertices.reduce((s, v) => s + v.y, 0)
    return { x: sumX / n, y: sumY / n }
  }

  signedArea *= 0.5
  return {
    x: cx / (6 * signedArea),
    y: cy / (6 * signedArea)
  }
}

/**
 * Compute bounding box of a set of points.
 */
export function computeBounds(vertices: Point[]): Bounds {
  if (vertices.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const v of vertices) {
    if (v.x < minX) minX = v.x
    if (v.y < minY) minY = v.y
    if (v.x > maxX) maxX = v.x
    if (v.y > maxY) maxY = v.y
  }

  return { minX, minY, maxX, maxY }
}

/**
 * Compute the concave/convex hull for a set of 2D points.
 *
 * Algorithm:
 * 1. If 0 points → empty result
 * 2. If 1 point → approximate circle around the point (12 segments)
 * 3. If 2 points → blob shape encompassing both points with margin
 * 4. If 3+ points → convex hull (monotone chain) → expand by margin → SVG path d
 *
 * @param points - Array of {x, y} points
 * @param options - Optional configuration (margin defaults to 60)
 * @returns HullResult with pathD, centroid, and bounds
 */
export function computeHull(points: Point[], options: HullOptions = {}): HullResult {
  const margin = options.margin ?? 60

  // Filter out NaN/Infinity points (defensive)
  const validPoints = points.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y)
  )

  if (validPoints.length === 0) {
    return {
      pathD: '',
      centroid: { x: 0, y: 0 },
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    }
  }

  // Deduplicate points for 1-2 point cases
  const uniquePoints = deduplicatePoints(validPoints)

  let vertices: Point[]

  if (uniquePoints.length === 1) {
    // Single point: circle approximation
    vertices = circlePath(uniquePoints[0], margin)
  } else if (uniquePoints.length === 2) {
    // Two points: blob shape
    vertices = twoPointBlob(uniquePoints[0], uniquePoints[1], margin)
  } else {
    // 3+ points: convex hull + margin expansion
    const hull = convexHull(validPoints)
    // If hull degenerated to < 3 points after dedup
    if (hull.length < 3) {
      if (hull.length === 1) {
        vertices = circlePath(hull[0], margin)
      } else if (hull.length === 2) {
        vertices = twoPointBlob(hull[0], hull[1], margin)
      } else {
        vertices = []
      }
    } else {
      vertices = expandHull(hull, margin)
    }
  }

  return {
    pathD: toSvgPathD(vertices),
    centroid: polygonCentroid(vertices),
    bounds: computeBounds(vertices)
  }
}

/**
 * Deduplicate points that are very close together.
 * Two points are considered equal if they are within epsilon distance of each other.
 */
function deduplicatePoints(points: Point[]): Point[] {
  if (points.length <= 1) return points
  const epsilon = 1e-6
  const result: Point[] = []
  for (const p of points) {
    const isDuplicate = result.some(
      (r) => Math.abs(r.x - p.x) < epsilon && Math.abs(r.y - p.y) < epsilon
    )
    if (!isDuplicate) {
      result.push(p)
    }
  }
  return result
}
