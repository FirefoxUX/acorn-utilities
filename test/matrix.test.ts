import { describe, it, expect } from 'vitest'
import {
  rotate,
  multiply,
  identity,
  fromFigmaTransform,
  toSvgMatrix,
  composePose,
  applyToPoint,
} from '../src/code/tools/filmstrips/svg/matrix'
import type { Pose } from '../src/code/tools/filmstrips/interpolate'

describe('fromFigmaTransform', () => {
  it('reads the Figma [[a,c,e],[b,d,f]] layout', () => {
    const m = fromFigmaTransform([
      [1, 2, 3],
      [4, 5, 6],
    ])
    expect(m).toEqual({ a: 1, c: 2, e: 3, b: 4, d: 5, f: 6 })
  })
})

describe('rotate', () => {
  it('uses the Figma convention R(θ)=[[cos,sin],[-sin,cos]]', () => {
    const m = rotate(Math.PI / 2)
    expect(m.a).toBeCloseTo(0, 6)
    expect(m.b).toBeCloseTo(-1, 6)
    expect(m.c).toBeCloseTo(1, 6)
    expect(m.d).toBeCloseTo(0, 6)
  })
})

describe('multiply', () => {
  it('leaves a matrix unchanged when multiplied by identity', () => {
    const m = { a: 2, b: 0, c: 0, d: 3, e: 5, f: 7 }
    expect(multiply(identity(), m)).toEqual(m)
  })
})

describe('toSvgMatrix', () => {
  it('serializes in a,b,c,d,e,f order', () => {
    expect(toSvgMatrix({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 })).toBe(
      'matrix(1 2 3 4 5 6)',
    )
  })
})

describe('composePose', () => {
  it('rotates a 10x10 node 90° about its own center', () => {
    const pose: Pose = { rotation: 90, fills: [], strokes: [] }
    const m = composePose(identity(), pose, 10, 10)
    // The center stays put under a center-pivot rotation.
    const center = applyToPoint(m, 5, 5)
    expect(center.x).toBeCloseTo(5, 4)
    expect(center.y).toBeCloseTo(5, 4)
    // The top-left corner rotates to another corner.
    const corner = applyToPoint(m, 0, 0)
    expect(corner.x).toBeCloseTo(0, 4)
    expect(corner.y).toBeCloseTo(10, 4)
  })
})
