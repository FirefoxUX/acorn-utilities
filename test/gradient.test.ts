import { describe, it, expect } from 'vitest'
import {
  linearHandles,
  radialTransform,
} from '../src/code/tools/filmstrips/svg/gradient'
import { fromFigmaTransform } from '../src/code/tools/filmstrips/svg/matrix'

describe('radialTransform', () => {
  // Gold reference: Figma's own SVG export of Frame 10's radial gradient
  // (gradient-static.svg) emits, for the 80x20 rect,
  //   radialGradient cx=0 cy=0 r=1 gradientTransform="translate(29 -15) scale(23.033 15.4323)"
  // i.e. an axis-aligned ellipse with rx=23.033, ry=15.4323. Our center stays in
  // local space (rect centre 40,10) because the rect's rotate(45) placement lives
  // on the leaf's world <g>, not in the gradient.
  it('reproduces Figma export radii for a real non-identity transform', () => {
    const t = fromFigmaTransform([
      [1.736638069152832, -9.05732754015497e-15, -0.36831900477409363],
      [2.0864344255663685e-14, 0.6479907035827637, 0.17600466310977936],
    ])
    const m = radialTransform(t, 80, 20)!
    // Column 0 is the x-radius vector, column 1 the y-radius vector.
    expect(m.a).toBeCloseTo(23.033, 2) // rx
    expect(m.b).toBeCloseTo(0, 4)
    expect(m.c).toBeCloseTo(0, 4)
    expect(m.d).toBeCloseTo(15.4323, 2) // ry
    expect(m.e).toBeCloseTo(40, 4) // local centre x (rect centre)
    expect(m.f).toBeCloseTo(10, 4) // local centre y
  })

  it('returns null for a singular transform', () => {
    const t = fromFigmaTransform([
      [0, 0, 0],
      [0, 0, 0],
    ])
    expect(radialTransform(t, 20, 20)).toBeNull()
  })
})

describe('linearHandles', () => {
  it('spans the box edge-to-edge for the identity transform', () => {
    const t = fromFigmaTransform([
      [1, 0, 0],
      [0, 1, 0],
    ])
    expect(linearHandles(t, 80, 20)).toEqual({ x1: 0, y1: 0, x2: 80, y2: 0 })
  })

  it('maps endpoints through the inverse of a scale+translate', () => {
    // A gradient scaled 2x in u and shifted: normalized handles invert to
    // (0,0)->(-0.25,0) start and (1,0)->(0.25,0) end, then scale by w/h.
    const t = fromFigmaTransform([
      [2, 0, 0.5],
      [0, 1, 0],
    ])
    const h = linearHandles(t, 40, 10)!
    expect(h.x1).toBeCloseTo(-10, 4)
    expect(h.y1).toBeCloseTo(0, 4)
    expect(h.x2).toBeCloseTo(10, 4)
    expect(h.y2).toBeCloseTo(0, 4)
  })

  it('returns null for a singular transform', () => {
    const t = fromFigmaTransform([
      [0, 0, 0],
      [0, 0, 0],
    ])
    expect(linearHandles(t, 20, 20)).toBeNull()
  })
})
