import { describe, it, expect } from 'vitest'
import {
  cubicLengthTable,
  arcFractionToT,
  splitCubic,
} from '../src/code/tools/filmstrips/svg/bezier'
import type { Cubic } from '../src/code/tools/filmstrips/svg/path-data'

function line(x0: number, y0: number, x1: number, y1: number): Cubic {
  return {
    p0: { x: x0, y: y0 },
    c1: { x: x0 + (x1 - x0) / 3, y: y0 + (y1 - y0) / 3 },
    c2: { x: x0 + (2 * (x1 - x0)) / 3, y: y0 + (2 * (y1 - y0)) / 3 },
    p3: { x: x1, y: y1 },
  }
}

function cubicPoint(seg: Cubic, t: number) {
  const u = 1 - t
  return {
    x:
      u * u * u * seg.p0.x +
      3 * u * u * t * seg.c1.x +
      3 * u * t * t * seg.c2.x +
      t * t * t * seg.p3.x,
    y:
      u * u * u * seg.p0.y +
      3 * u * u * t * seg.c1.y +
      3 * u * t * t * seg.c2.y +
      t * t * t * seg.p3.y,
  }
}

describe('cubicLengthTable', () => {
  it('measures a straight-line cubic as its endpoint distance', () => {
    const table = cubicLengthTable(line(0, 0, 100, 0))
    expect(table.totalLength).toBeCloseTo(100, 1)
  })
})

describe('arcFractionToT', () => {
  it('returns the endpoints for 0 and 1', () => {
    const table = cubicLengthTable(line(0, 0, 100, 0))
    expect(arcFractionToT(table, 0)).toBe(0)
    expect(arcFractionToT(table, 1)).toBe(1)
  })

  it('maps the midpoint of a straight line to t=0.5', () => {
    const table = cubicLengthTable(line(0, 0, 100, 0))
    expect(arcFractionToT(table, 0.5)).toBeCloseTo(0.5, 2)
  })
})

describe('splitCubic', () => {
  it('keeps the endpoints of a full [0,1] split', () => {
    const seg = line(0, 0, 30, 40)
    const whole = splitCubic(seg, 0, 1)
    expect(whole.p0.x).toBeCloseTo(0, 6)
    expect(whole.p3.x).toBeCloseTo(30, 6)
    expect(whole.p3.y).toBeCloseTo(40, 6)
  })

  it('produces sub-curve endpoints that lie on the original curve', () => {
    const seg: Cubic = {
      p0: { x: 0, y: 0 },
      c1: { x: 0, y: 60 },
      c2: { x: 60, y: 60 },
      p3: { x: 60, y: 0 },
    }
    const piece = splitCubic(seg, 0.25, 0.75)
    const at25 = cubicPoint(seg, 0.25)
    const at75 = cubicPoint(seg, 0.75)
    expect(piece.p0.x).toBeCloseTo(at25.x, 3)
    expect(piece.p0.y).toBeCloseTo(at25.y, 3)
    expect(piece.p3.x).toBeCloseTo(at75.x, 3)
    expect(piece.p3.y).toBeCloseTo(at75.y, 3)
  })
})
