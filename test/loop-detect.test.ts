import { describe, it, expect } from 'vitest'
import {
  tracksReturnToStart,
  type NodeTracks,
} from '../src/code/tools/filmstrips/interpolate'

function keys(...vals: number[]) {
  return vals.map((value, i) => ({ time: i * 0.1, value, easing: undefined }))
}

function colorKeys(...vals: RGBA[]) {
  return vals.map((value, i) => ({ time: i * 0.1, value, easing: undefined }))
}

function tracks(
  numeric: NodeTracks['numeric'],
  fills = new Map(),
  strokes = new Map(),
): NodeTracks {
  return { numeric, fills, strokes, unsupportedNotes: [] }
}

describe('tracksReturnToStart', () => {
  it('true for a full spin (0 -> 360)', () => {
    expect(tracksReturnToStart(tracks({ rotation: keys(0, 360) }))).toBe(true)
  })

  it('true for a negative spin (-90 -> 270), guarding JS % sign', () => {
    expect(tracksReturnToStart(tracks({ rotation: keys(-90, 270) }))).toBe(true)
  })

  it('true near the wrap boundary via shortest distance (0 -> 359.9999)', () => {
    // A naive `a % 360 === b % 360` would call this a huge difference; shortest
    // angular distance is ~1e-4, within tolerance.
    expect(tracksReturnToStart(tracks({ rotation: keys(0, 359.9999) }))).toBe(
      true,
    )
  })

  it('false for a half turn (0 -> 180)', () => {
    expect(tracksReturnToStart(tracks({ rotation: keys(0, 180) }))).toBe(false)
  })

  it('false for a fade-in (opacity 0 -> 1)', () => {
    expect(tracksReturnToStart(tracks({ opacity: keys(0, 1) }))).toBe(false)
  })

  it('true for a pulse that returns (opacity 0 -> 1 -> 0)', () => {
    expect(tracksReturnToStart(tracks({ opacity: keys(0, 1, 0) }))).toBe(true)
  })

  it('true for a full trim-offset wrap (0 -> 1)', () => {
    expect(tracksReturnToStart(tracks({ trimOffset: keys(0, 1) }))).toBe(true)
  })

  it('true for a single (constant) keyframe', () => {
    expect(tracksReturnToStart(tracks({ translateX: keys(5) }))).toBe(true)
  })

  it('false if any one field does not return', () => {
    // opacity returns, rotation does not.
    const t = tracks({ opacity: keys(0, 1, 0), rotation: keys(0, 90) })
    expect(tracksReturnToStart(t)).toBe(false)
  })

  it('compares color tracks and returns false when they differ', () => {
    const black: RGBA = { r: 0, g: 0, b: 0, a: 1 }
    const white: RGBA = { r: 1, g: 1, b: 1, a: 1 }
    const fills = new Map([[0, colorKeys(black, white)]])
    expect(tracksReturnToStart(tracks({}, fills))).toBe(false)
  })

  it('true when a color track returns to its start', () => {
    const red: RGBA = { r: 1, g: 0, b: 0, a: 1 }
    const strokes = new Map([[0, colorKeys(red, { ...red, a: 0 }, red)]])
    expect(tracksReturnToStart(tracks({}, new Map(), strokes))).toBe(true)
  })
})
