import { describe, it, expect } from 'vitest'
import { trimSubpaths } from '../src/code/tools/filmstrips/svg/trim'
import { cubicLengthTable } from '../src/code/tools/filmstrips/svg/bezier'
import type { Cubic, Subpath } from '../src/code/tools/filmstrips/svg/path-data'

function line(x0: number, y0: number, x1: number, y1: number): Cubic {
  return {
    p0: { x: x0, y: y0 },
    c1: { x: x0 + (x1 - x0) / 3, y: y0 + (y1 - y0) / 3 },
    c2: { x: x0 + (2 * (x1 - x0)) / 3, y: y0 + (2 * (y1 - y0)) / 3 },
    p3: { x: x1, y: y1 },
  }
}

function totalLength(subpaths: Subpath[]): number {
  let sum = 0
  for (const sp of subpaths) {
    for (const seg of sp.segments) sum += cubicLengthTable(seg).totalLength
  }
  return sum
}

const straight: Subpath[] = [{ closed: false, segments: [line(0, 0, 100, 0)] }]

describe('trimSubpaths', () => {
  it('returns the input unchanged for the full range', () => {
    const out = trimSubpaths(straight, 0, 1, 0, 1)
    expect(out).toBe(straight)
  })

  it('keeps half the length for [0, 0.5]', () => {
    const out = trimSubpaths(straight, 0, 0.5, 0, 1)
    expect(totalLength(out)).toBeCloseTo(50, 0)
  })

  it('drops both ends for [0.25, 0.75]', () => {
    const out = trimSubpaths(straight, 0.25, 0.75, 0, 1)
    expect(totalLength(out)).toBeCloseTo(50, 0)
  })

  it('returns [] when start equals end', () => {
    expect(trimSubpaths(straight, 0.5, 0.5, 0, 1)).toEqual([])
  })

  it('returns [] below the cap-bloom epsilon', () => {
    // Kept length 0.1px is below max(0.5, 0.02*2)=0.5.
    expect(trimSubpaths(straight, 0, 0.001, 0, 2)).toEqual([])
  })
})
