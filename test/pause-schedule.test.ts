import { describe, it, expect } from 'vitest'
import {
  buildSchedule,
  type PausePoint,
  type Segment,
} from '../src/tools/filmstrips/pause-schedule'

function pause(id: string, atFrame: number, durationMs: number): PausePoint {
  return { id, atFrame, durationMs }
}

// These cases all exercise loop mode; one-shot has its own describe block below.
const sched = (
  frameCount: number,
  durationMs: number,
  pauses: PausePoint[],
) => buildSchedule(frameCount, durationMs, pauses, true)

const plays = (segs: Segment[]) => segs.filter((s) => s.kind === 'play')
const holds = (segs: Segment[]) => segs.filter((s) => s.kind === 'hold')

describe('buildSchedule', () => {
  it('with no pauses, is one play segment over the whole timeline', () => {
    const { segments, totalDurationMs } = sched(26, 1000, [])
    expect(totalDurationMs).toBe(1000)
    expect(segments).toHaveLength(1)
    const seg = segments[0]
    expect(seg.kind).toBe('play')
    if (seg.kind === 'play') {
      expect(seg.fromFrame).toBe(0)
      expect(seg.toFrame).toBe(26)
      expect(seg.steps).toBe(26)
      expect(seg.startPct).toBe(0)
      expect(seg.endPct).toBe(1)
    }
  })

  it('one interior pause splits into play / hold / wrap-play (indicator.css case)', () => {
    // 26 frames, 1s, hold 1667ms at frame 18 ~= indicator.css finish animation.
    const { segments, totalDurationMs } = sched(26, 1000, [
      pause('a', 18, 1667),
    ])
    expect(segments).toHaveLength(3)
    expect(totalDurationMs).toBeCloseTo(2667.0, 1)

    const [p1, h, p2] = segments
    expect(p1).toMatchObject({ kind: 'play', fromFrame: 0, toFrame: 18, steps: 18 })
    expect(h).toMatchObject({ kind: 'hold', atFrame: 18, durationMs: 1667 })
    expect(p2).toMatchObject({ kind: 'play', fromFrame: 18, toFrame: 26, steps: 8 })

    expect(p1.startPct).toBeCloseTo(0, 4)
    expect(p1.endPct).toBeCloseTo(0.2596, 3)
    expect(h.endPct).toBeCloseTo(0.8846, 3)
    expect(p2.endPct).toBeCloseTo(1, 4)
  })

  it('pause at frame 0 holds first (no play before it)', () => {
    const { segments } = sched(10, 500, [pause('a', 0, 300)])
    expect(segments[0]).toMatchObject({ kind: 'hold', atFrame: 0, startPct: 0 })
    // then a single wrap play from 0 to frameCount
    expect(plays(segments)).toHaveLength(1)
    expect(plays(segments)[0]).toMatchObject({ fromFrame: 0, toFrame: 10, steps: 10 })
  })

  it('pause at the last frame synthesizes no trailing wrap play', () => {
    const { segments } = sched(10, 500, [pause('a', 9, 400)])
    // play 0->9, then hold@9. and nothing after.
    expect(segments).toHaveLength(2)
    expect(segments[0]).toMatchObject({ kind: 'play', fromFrame: 0, toFrame: 9, steps: 9 })
    expect(segments[1]).toMatchObject({ kind: 'hold', atFrame: 9 })
    expect(segments[1].endPct).toBeCloseTo(1, 4)
  })

  it('two pauses (interior + last frame) give four alternating segments', () => {
    const { segments, totalDurationMs } = sched(26, 1000, [
      pause('a', 18, 1667),
      pause('b', 25, 500),
    ])
    expect(totalDurationMs).toBeCloseTo(3128.5, 1)
    expect(segments.map((s) => s.kind)).toEqual(['play', 'hold', 'play', 'hold'])
    expect(segments[2]).toMatchObject({ kind: 'play', fromFrame: 18, toFrame: 25, steps: 7 })
    // ends on the last-frame hold, no wrap play
    expect(segments[3]).toMatchObject({ kind: 'hold', atFrame: 25 })
    expect(segments[3].endPct).toBeCloseTo(1, 4)
  })

  it('merges duplicate-frame pauses by summing their durations', () => {
    const { segments } = sched(10, 500, [
      pause('a', 5, 200),
      pause('b', 5, 300),
    ])
    const h = holds(segments)
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({ atFrame: 5, durationMs: 500 })
  })

  it('drops non-positive-duration pauses', () => {
    const withZero = sched(10, 500, [pause('a', 5, 0), pause('b', 3, -100)])
    const without = sched(10, 500, [])
    expect(withZero.segments).toEqual(without.segments)
    expect(withZero.totalDurationMs).toBe(without.totalDurationMs)
  })

  it('clamps out-of-range pause frames into [0, frameCount-1]', () => {
    const { segments } = sched(10, 500, [pause('a', 99, 100)])
    // clamped to frame 9 (last) -> play 0->9 then hold@9, no wrap
    expect(holds(segments)[0].atFrame).toBe(9)
  })

  it('degenerate frameCount <= 1 yields no segments', () => {
    expect(sched(1, 500, [pause('a', 0, 100)])).toEqual({
      segments: [],
      totalDurationMs: 500,
    })
  })
})

describe('buildSchedule one-shot (loop = false)', () => {
  it('advances past a pause on the last frame to the resting cell', () => {
    // Loop mode would suppress the trailing play and wrap from the hold; one-shot
    // must still advance frame 9 -> 10 (the resting cell) and hold there.
    const { segments } = buildSchedule(10, 500, [pause('a', 9, 400)], false)
    expect(segments.map((s) => s.kind)).toEqual(['play', 'hold', 'play'])
    expect(segments[2]).toMatchObject({
      kind: 'play',
      fromFrame: 9,
      toFrame: 10,
      steps: 1,
    })
    expect(segments[2].endPct).toBeCloseTo(1, 4)
  })

  it('with no pauses matches loop mode (only the driver differs)', () => {
    const once = buildSchedule(10, 500, [], false)
    const loop = buildSchedule(10, 500, [], true)
    expect(once.segments).toEqual(loop.segments)
  })
})
