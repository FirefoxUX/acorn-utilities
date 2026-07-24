import { describe, it, expect } from 'vitest'
import { outlineStroke } from '../src/code/tools/filmstrips/svg/outline'
import { installBigIntPolyfill } from '../src/code/tools/filmstrips/svg/bigint-polyfill'
import type { Cubic, Point, Subpath } from '../src/code/tools/filmstrips/svg/path-data'

function line(x0: number, y0: number, x1: number, y1: number): Cubic {
  return {
    p0: { x: x0, y: y0 },
    c1: { x: x0 + (x1 - x0) / 3, y: y0 + (y1 - y0) / 3 },
    c2: { x: x0 + (2 * (x1 - x0)) / 3, y: y0 + (2 * (y1 - y0)) / 3 },
    p3: { x: x1, y: y1 },
  }
}

// Summed shoelace area over the offset polygons (rings of points).
function area(polygons: Point[][]): number {
  let total = 0
  for (const pts of polygons) {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      total += a.x * b.y - b.x * a.y
    }
  }
  return Math.abs(total) / 2
}

const straight: Subpath[] = [{ closed: false, segments: [line(0, 0, 100, 0)] }]

describe('outlineStroke', () => {
  it('outlines a butt-capped stroke to about width*length', () => {
    const out = outlineStroke(straight, {
      width: 10,
      cap: 'butt',
      join: 'miter',
      miterLimit: 4,
    })
    expect(out.length).toBeGreaterThan(0)
    expect(out[0].length).toBeGreaterThanOrEqual(3)
    // 100 long * 10 wide = 1000, butt caps add no area.
    expect(area(out)).toBeGreaterThan(950)
    expect(area(out)).toBeLessThan(1050)
  })

  it('adds cap area for a round cap', () => {
    const butt = area(
      outlineStroke(straight, { width: 10, cap: 'butt', join: 'miter', miterLimit: 4 }),
    )
    const round = area(
      outlineStroke(straight, { width: 10, cap: 'round', join: 'miter', miterLimit: 4 }),
    )
    // Two round caps add roughly a full circle of radius 5 (~78.5).
    expect(round).toBeGreaterThan(butt + 50)
  })

  it('returns [] for zero width', () => {
    expect(
      outlineStroke(straight, { width: 0, cap: 'butt', join: 'miter', miterLimit: 4 }),
    ).toEqual([])
  })

  it('works when the BigInt global is absent (Figma sandbox simulation)', () => {
    const g = globalThis as { BigInt?: unknown }
    const original = g.BigInt
    try {
      delete g.BigInt
      installBigIntPolyfill()
      expect(typeof g.BigInt).toBe('function')
      const out = outlineStroke(straight, {
        width: 10,
        cap: 'butt',
        join: 'miter',
        miterLimit: 4,
      })
      expect(out.length).toBeGreaterThan(0)
      expect(area(out)).toBeGreaterThan(900)
    } finally {
      g.BigInt = original
    }
  })
})
