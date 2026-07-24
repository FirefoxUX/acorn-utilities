import { describe, it, expect } from 'vitest'
import { readStoredPauses } from '../src/code/tools/filmstrips/pauses-meta'

// readStoredPauses only reads node.getPluginData, so a minimal stub stands in
// for a Figma node. The value is whatever was stored under the pauses key.
function nodeWith(raw: string) {
  return { getPluginData: () => raw } as unknown as Parameters<
    typeof readStoredPauses
  >[0]
}

describe('readStoredPauses', () => {
  it('returns stored pauses within range', () => {
    const raw = JSON.stringify([
      { atFrame: 5, durationMs: 500 },
      { atFrame: 18, durationMs: 1667 },
    ])
    expect(readStoredPauses(nodeWith(raw), 26)).toEqual([
      { atFrame: 5, durationMs: 500 },
      { atFrame: 18, durationMs: 1667 },
    ])
  })

  it('empty when nothing is stored', () => {
    expect(readStoredPauses(nodeWith(''), 26)).toEqual([])
  })

  it('empty on garbage JSON or a non-array', () => {
    expect(readStoredPauses(nodeWith('not json'), 26)).toEqual([])
    expect(readStoredPauses(nodeWith('{"atFrame":1}'), 26)).toEqual([])
  })

  it('drops out-of-range frames rather than clamping', () => {
    const raw = JSON.stringify([
      { atFrame: 40, durationMs: 500 },
      { atFrame: 10, durationMs: 300 },
      { atFrame: -1, durationMs: 300 },
    ])
    // At 30 frames, only frame 10 survives; 40 and -1 are dropped (not clamped
    // onto frame 29 / 0, which would collapse distinct pauses).
    expect(readStoredPauses(nodeWith(raw), 30)).toEqual([
      { atFrame: 10, durationMs: 300 },
    ])
  })

  it('drops non-positive durations and rounds values', () => {
    const raw = JSON.stringify([
      { atFrame: 3, durationMs: 0 },
      { atFrame: 4.6, durationMs: 250.4 },
    ])
    expect(readStoredPauses(nodeWith(raw), 26)).toEqual([
      { atFrame: 5, durationMs: 250 },
    ])
  })

  it('skips malformed entries', () => {
    const raw = JSON.stringify([
      { atFrame: '2', durationMs: 500 },
      null,
      { durationMs: 500 },
      { atFrame: 7, durationMs: 400 },
    ])
    expect(readStoredPauses(nodeWith(raw), 26)).toEqual([
      { atFrame: 7, durationMs: 400 },
    ])
  })
})
