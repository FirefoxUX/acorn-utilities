import { describe, it, expect } from 'vitest'
import {
  parsePath,
  subpathsToData,
  type Cubic,
} from '../src/code/tools/filmstrips/svg/path-data'

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

describe('parsePath', () => {
  it('promotes L to a collinear cubic', () => {
    const [sp] = parsePath('M0 0L10 0')
    expect(sp.segments).toHaveLength(1)
    const seg = sp.segments[0]
    // Midpoint of a line-cubic lies on the straight line.
    const mid = cubicPoint(seg, 0.5)
    expect(mid.x).toBeCloseTo(5, 6)
    expect(mid.y).toBeCloseTo(0, 6)
  })

  it('parses a cubic C command with absolute controls', () => {
    const [sp] = parsePath('M0 0C0 10 10 10 10 0')
    const seg = sp.segments[0]
    expect(seg.p0).toEqual({ x: 0, y: 0 })
    expect(seg.c1).toEqual({ x: 0, y: 10 })
    expect(seg.c2).toEqual({ x: 10, y: 10 })
    expect(seg.p3).toEqual({ x: 10, y: 0 })
  })

  it('splits multiple M into separate subpaths', () => {
    const subpaths = parsePath('M0 0L1 0M5 5L6 5')
    expect(subpaths).toHaveLength(2)
  })

  it('marks a Z subpath closed and appends the closing segment', () => {
    const [sp] = parsePath('M0 0L10 0L10 10Z')
    expect(sp.closed).toBe(true)
    // Last segment returns to the start point.
    const last = sp.segments[sp.segments.length - 1]
    expect(last.p3).toEqual({ x: 0, y: 0 })
  })

  it('round-trips geometry through serialize + parse', () => {
    const data = 'M0 0C0 10 10 10 10 0'
    const again = parsePath(subpathsToData(parsePath(data)))
    const a = again[0].segments[0]
    expect(cubicPoint(a, 0.5).x).toBeCloseTo(5, 3)
  })
})
