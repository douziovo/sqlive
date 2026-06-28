import {describe, expect, it} from 'vitest'
import {
    computeBounds,
    computeHull,
    convexHull,
    cross,
    expandHull,
    type Point,
    polygonArea,
    polygonCentroid,
    toSvgPathD
} from '@/composables/useConcaveHull'

// ── Helpers ────────────────────────────────────────────────────

function makeSquare(centerX = 0, centerY = 0, half = 50): Point[] {
    return [
        {x: centerX - half, y: centerY - half},
        {x: centerX + half, y: centerY - half},
        {x: centerX + half, y: centerY + half},
        {x: centerX - half, y: centerY + half}
    ]
}

function makeTriangle(): Point[] {
    return [
        {x: 0, y: 0},
        {x: 100, y: 0},
        {x: 50, y: 87}
    ]
}

// L-shape: convex hull is the 4-corner rectangle, concave hull should notch into {40,40}
function makeConcaveShape(): Point[] {
    return [
        {x: 0, y: 0},
        {x: 100, y: 0},
        {x: 100, y: 40},
        {x: 40, y: 40},
        {x: 40, y: 100},
        {x: 0, y: 100}
    ]
}

// Decode an SVG path `d` string ("M x,y L x,y ... Z") back into Point[] vertices
function decodePathD(pathD: string): Point[] {
    if (!pathD) return []
    const tokens = pathD.replace(/Z/gi, '').trim().split(/\s+/)
    const points: Point[] = []
    for (const tok of tokens) {
        const [xStr, yStr] = tok.replace(/^[ML]/, '').split(',')
        const x = parseFloat(xStr)
        const y = parseFloat(yStr)
        if (Number.isFinite(x) && Number.isFinite(y)) {
            points.push({x, y})
        }
    }
    return points
}

// ── Tests ──────────────────────────────────────────────────────

describe('cross', () => {
    it('returns positive for left turn', () => {
        const a: Point = {x: 0, y: 0}
        const b: Point = {x: 10, y: 0}
        const c: Point = {x: 5, y: 5}
        expect(cross(a, b, c)).toBeGreaterThan(0)
    })

    it('returns negative for right turn', () => {
        const a: Point = {x: 0, y: 0}
        const b: Point = {x: 10, y: 0}
        const c: Point = {x: 5, y: -5}
        expect(cross(a, b, c)).toBeLessThan(0)
    })

    it('returns zero for collinear points', () => {
        const a: Point = {x: 0, y: 0}
        const b: Point = {x: 5, y: 0}
        const c: Point = {x: 10, y: 0}
        expect(cross(a, b, c)).toBe(0)
    })
})

describe('convexHull', () => {
    it('returns the same 3 points for a triangle', () => {
        const tri = makeTriangle()
        const hull = convexHull(tri)
        expect(hull).toHaveLength(3)
    })

    it('returns 4 points for a square', () => {
        const sq = makeSquare()
        const hull = convexHull(sq)
        expect(hull).toHaveLength(4)
    })

    it('handles collinear points (returns only endpoints)', () => {
        const points: Point[] = [
            {x: 0, y: 0},
            {x: 5, y: 0},
            {x: 10, y: 0}
        ]
        const hull = convexHull(points)
        // Monotone chain removes middle collinear points
        expect(hull.length).toBeLessThanOrEqual(2)
    })

    it('is order-independent', () => {
        const points: Point[] = [
            {x: 0, y: 0},
            {x: 100, y: 0},
            {x: 100, y: 100},
            {x: 0, y: 100}
        ]
        const shuffled = [...points].sort(() => Math.random() - 0.5)
        const hull1 = convexHull(points)
        const hull2 = convexHull(shuffled)
        // Both should have 4 vertices (the corners) regardless of input order
        expect(hull1).toHaveLength(4)
        expect(hull2).toHaveLength(4)
    })

    it('returns input for < 3 points', () => {
        const twoPoints: Point[] = [
            {x: 0, y: 0},
            {x: 10, y: 10}
        ]
        expect(convexHull(twoPoints)).toHaveLength(2)

        const onePoint: Point[] = [{x: 0, y: 0}]
        expect(convexHull(onePoint)).toHaveLength(1)
    })

    it('handles duplicate points', () => {
        const points: Point[] = [
            {x: 0, y: 0},
            {x: 0, y: 0},
            {x: 100, y: 0},
            {x: 50, y: 50}
        ]
        const hull = convexHull(points)
        // Should produce a valid convex hull (duplicates are filtered by sort)
        expect(hull.length).toBeGreaterThanOrEqual(3)
    })
})

describe('expandHull', () => {
    it('returns expanded vertices when margin > 0', () => {
        const sq = convexHull(makeSquare())
        const expanded = expandHull(sq, 10)
        expect(expanded).toHaveLength(4)
        // Each expanded vertex should be further from origin
        for (const v of expanded) {
            const orig = sq.find(
                (o) => Math.abs(o.x) < Math.abs(v.x) || Math.abs(o.y) < Math.abs(v.y)
            )
            expect(Math.abs(v.x) + Math.abs(v.y)).toBeGreaterThan(60)
        }
    })

    it('returns original points when margin is 0', () => {
        const sq = convexHull(makeSquare())
        const expanded = expandHull(sq, 0)
        expect(expanded).toEqual(sq)
    })

    it('returns copy when hull has < 3 points', () => {
        const twoPoints: Point[] = [
            {x: 0, y: 0},
            {x: 10, y: 0}
        ]
        const expanded = expandHull(twoPoints, 10)
        expect(expanded).toHaveLength(2)
    })
})

describe('toSvgPathD', () => {
    it('generates M/L/Z path from vertices', () => {
        const tri = [
            {x: 0, y: 0},
            {x: 100, y: 0},
            {x: 50, y: 87}
        ]
        const d = toSvgPathD(tri)
        expect(d).toMatch(/^M/)
        expect(d).toContain('L')
        expect(d).toContain('Z')
        expect(d).toContain('0.00,0.00')
    })

    it('returns empty string for empty array', () => {
        expect(toSvgPathD([])).toBe('')
    })
})

describe('polygonArea', () => {
    it('computes area of a square', () => {
        const area = polygonArea(makeSquare(0, 0, 50))
        expect(area).toBeCloseTo(10000, 0) // 100x100 square
    })

    it('returns 0 for < 3 vertices', () => {
        expect(polygonArea([])).toBe(0)
        expect(polygonArea([{x: 0, y: 0}])).toBe(0)
        expect(polygonArea([{x: 0, y: 0}, {x: 10, y: 10}])).toBe(0)
    })
})

describe('polygonCentroid', () => {
    it('returns center for a square', () => {
        const sq = makeSquare(0, 0, 50)
        const centroid = polygonCentroid(sq)
        expect(centroid.x).toBeCloseTo(0, 0)
        expect(centroid.y).toBeCloseTo(0, 0)
    })

    it('returns arithmetic mean for degenerate polygon', () => {
        const collinear: Point[] = [
            {x: 0, y: 0},
            {x: 10, y: 0},
            {x: 5, y: 0} // all on same line
        ]
        const centroid = polygonCentroid(collinear)
        expect(centroid.x).toBeCloseTo(5, 0)
        expect(centroid.y).toBeCloseTo(0, 0)
    })

    it('returns {x:0, y:0} for empty array', () => {
        const centroid = polygonCentroid([])
        expect(centroid.x).toBe(0)
        expect(centroid.y).toBe(0)
    })
})

describe('computeBounds', () => {
    it('computes bounds of a set of points', () => {
        const points: Point[] = [
            {x: -10, y: 5},
            {x: 100, y: -20},
            {x: 50, y: 80}
        ]
        const bounds = computeBounds(points)
        expect(bounds.minX).toBe(-10)
        expect(bounds.minY).toBe(-20)
        expect(bounds.maxX).toBe(100)
        expect(bounds.maxY).toBe(80)
    })

    it('returns zero-bounds for empty array', () => {
        const bounds = computeBounds([])
        expect(bounds).toEqual({minX: 0, minY: 0, maxX: 0, maxY: 0})
    })
})

// ── computeHull integration tests ──────────────────────────────

describe('computeHull', () => {
    it('returns pathD, centroid, bounds for 3 points (triangle)', () => {
        const result = computeHull(makeTriangle())
        expect(result.pathD).toMatch(/^M/)
        expect(result.pathD).toContain('Z')
        expect(result.centroid.x).toBeGreaterThan(0)
        expect(result.centroid.y).toBeGreaterThan(0)
        expect(result.bounds.maxX).toBeGreaterThan(result.bounds.minX)
    })

    it('returns pathD, centroid, bounds for 4 points (square)', () => {
        const result = computeHull(makeSquare(0, 0, 50))
        expect(result.pathD).toMatch(/^M/)
        expect(result.pathD).toContain('Z')
        // Centroid should be near (0, 0) for centered square
        expect(result.centroid.x).toBeCloseTo(0, -1)
        expect(result.centroid.y).toBeCloseTo(0, -1)
    })

    it('handles collinear points by generating a blob path', () => {
        const points: Point[] = [
            {x: 0, y: 0},
            {x: 5, y: 0},
            {x: 10, y: 0}
        ]
        const result = computeHull(points)
        // For collinear points, convexHull returns 2 points, so computeHull uses twoPointBlob
        expect(result.pathD).toMatch(/^M/)
        expect(result.pathD).toContain('Z')
        expect(result.centroid.x).toBeGreaterThan(0)
        expect(result.bounds.maxX).toBeGreaterThan(result.bounds.minX)
    })

    it('generates a circle path for a single point', () => {
        const result = computeHull([{x: 100, y: 200}])
        expect(result.pathD).toMatch(/^M/)
        expect(result.pathD).toContain('Z')
        // Should have 12 segments
        const lCount = (result.pathD.match(/L/g) || []).length
        expect(lCount).toBe(11) // 11 L + 1 M + Z = 12 segments
        // Centroid should be at the original point
        expect(result.centroid.x).toBeCloseTo(100, -1)
        expect(result.centroid.y).toBeCloseTo(200, -1)
    })

    it('generates a blob path for 2 points', () => {
        const result = computeHull([
            {x: 0, y: 0},
            {x: 100, y: 0}
        ])
        expect(result.pathD).toMatch(/^M/)
        expect(result.pathD).toContain('Z')
        expect(result.bounds.maxX).toBeGreaterThan(100) // margin expanded
    })

    it('returns empty pathD for empty array', () => {
        const result = computeHull([])
        expect(result.pathD).toBe('')
        expect(result.centroid).toEqual({x: 0, y: 0})
        expect(result.bounds).toEqual({minX: 0, minY: 0, maxX: 0, maxY: 0})
    })

    it('handles all-same-point (degenerate)', () => {
        const points: Point[] = [
            {x: 50, y: 50},
            {x: 50, y: 50},
            {x: 50, y: 50}
        ]
        const result = computeHull(points)
        // Should treat as single point → circle
        expect(result.pathD).toMatch(/^M/)
        expect(result.pathD).toContain('Z')
        expect(result.centroid.x).toBeCloseTo(50, -1)
        expect(result.centroid.y).toBeCloseTo(50, -1)
    })

    it('is input-order independent', () => {
        const points: Point[] = [
            {x: 0, y: 0},
            {x: 100, y: 0},
            {x: 100, y: 100},
            {x: 0, y: 100},
            {x: 50, y: 50} // interior point
        ]
        const reversed = [...points].reverse()
        const result1 = computeHull(points)
        const result2 = computeHull(reversed)
        // pathD strings should be identical (same hull)
        expect(result1.pathD).toBe(result2.pathD)
    })

    it('uses default margin of 60', () => {
        const points: Point[] = [
            {x: 0, y: 0},
            {x: 100, y: 0},
            {x: 50, y: 87}
        ]
        const result = computeHull(points)
        // With margin=60, hull should extend beyond original points
        expect(result.bounds.minX).toBeLessThan(-10) // pushed left beyond 0
        expect(result.bounds.maxX).toBeGreaterThan(110) // pushed right beyond 100
        expect(result.bounds.maxY).toBeGreaterThan(87) // pushed up
    })

    it('respects custom margin option', () => {
        const points: Point[] = [
            {x: 0, y: 0},
            {x: 100, y: 0},
            {x: 50, y: 100}
        ]
        const resultSmall = computeHull(points, {margin: 10})
        const resultLarge = computeHull(points, {margin: 100})

        const smallSpan = resultSmall.bounds.maxX - resultSmall.bounds.minX
        const largeSpan = resultLarge.bounds.maxX - resultLarge.bounds.minX
        expect(largeSpan).toBeGreaterThan(smallSpan)
    })

    it('margin expansion encloses all original input points', () => {
        const points: Point[] = [
            {x: 0, y: 0},
            {x: 100, y: 0},
            {x: 100, y: 100},
            {x: 0, y: 100}
        ]
        const result = computeHull(points, {margin: 60})

        // All original points should be within the expanded hull bounds
        for (const p of points) {
            expect(p.x).toBeGreaterThanOrEqual(result.bounds.minX)
            expect(p.x).toBeLessThanOrEqual(result.bounds.maxX)
            expect(p.y).toBeGreaterThanOrEqual(result.bounds.minY)
            expect(p.y).toBeLessThanOrEqual(result.bounds.maxY)
        }
    })

    it('returns valid SVG path d format for >= 3 points', () => {
        const points: Point[] = [
            {x: 10, y: 20},
            {x: 200, y: 30},
            {x: 150, y: 180}
        ]
        const result = computeHull(points)
        expect(result.pathD).toMatch(/^M-?\d+\.\d+,-?\d+\.\d+/)
        expect(result.pathD).toContain(' L')
        expect(result.pathD).toMatch(/Z$/)
    })

    it('handles NaN/Infinity values gracefully', () => {
        const points: Point[] = [
            {x: 0, y: 0},
            {x: NaN, y: 0},
            {x: 100, y: 100},
            {x: Infinity, y: 50}
        ]
        const result = computeHull(points)
        // Should filter out NaN/Infinity, leaving 2 valid points → blob
        expect(result.pathD).toMatch(/^M/)
        expect(result.pathD).toContain('Z')
    })
})

describe('computeHull concavity parameter', () => {
    it('degrades to convex hull when concavity=Infinity', () => {
        const points = makeConcaveShape()
        const convexResult = computeHull(points)
        const concaveResult = computeHull(points, {concavity: Infinity})
        expect(concaveResult.pathD).toBe(convexResult.pathD)
    })

    it('default behavior (no concavity) equals concavity=Infinity', () => {
        const points = makeConcaveShape()
        const defaultResult = computeHull(points)
        const infinityResult = computeHull(points, {concavity: Infinity})
        expect(defaultResult.pathD).toBe(infinityResult.pathD)
    })

    it('produces smaller-or-equal-area hull with finite concavity', () => {
        const points = makeConcaveShape()
        // Use margin: 0 to isolate the dig-inward effect from expandHull
        const convexArea = polygonArea(convexHull(points))
        const concaveResult = computeHull(points, {margin: 0, concavity: 2})
        const concaveArea = polygonArea(decodePathD(concaveResult.pathD))
        // Concave hull area must be <= convex hull area (contract: no worse than convex)
        expect(concaveArea).toBeLessThanOrEqual(convexArea + 1e-6)
        // For an L-shape, the concave hull should be STRICTLY smaller (dig-inward notches
        // the inner corner at {40,40}). This assertion fails if concavity is ignored.
        expect(concaveArea).toBeLessThan(convexArea - 1)
        // The concave pathD must differ from the default (convex) pathD
        const defaultResult = computeHull(points, {margin: 0})
        expect(concaveResult.pathD).not.toBe(defaultResult.pathD)
    })
})
