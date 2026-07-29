import { describe, it, expect } from 'vitest'
import { computeFirefoxMetadata } from '../src/tools/filmstrips/firefox-comment'
import type { PausePoint } from '../src/tools/filmstrips/pause-schedule'

function pause(id: string, atFrame: number, durationMs: number): PausePoint {
  return { id, atFrame, durationMs }
}

// The base cases exercise loop mode; one-shot has its own block below.
const ffc = (
  frameCount: number,
  durationMs: number,
  cellW: number,
  cellH: number,
  pauses: PausePoint[],
) => computeFirefoxMetadata(frameCount, durationMs, cellW, cellH, pauses, true)

describe('computeFirefoxMetadata', () => {
  it('is a <metadata> block, not an XML comment (so it can use `--`)', () => {
    const c = ffc(26, 433, 20, 20, [])
    expect(c.startsWith('<metadata>')).toBe(true)
    expect(c.trimEnd().endsWith('</metadata>')).toBe(true)
    expect(c).not.toContain('<!--')
    // Custom properties (illegal inside an XML comment) are present.
    expect(c).toContain('--anim-frames: 26;')
    expect(c).toContain('var(--anim-steps)')
  })

  it('drives width, duration, and the wrap off custom properties', () => {
    const c = ffc(26, 433, 20, 16, [])
    expect(c).toContain('overflow: hidden;')
    expect(c).toContain('@keyframes filmstrip {')
    // No pauses => anim-steps equals the frame count.
    expect(c).toContain('--anim-steps: 26;')
    // Loop strip is N cells wide.
    expect(c).toContain('width: calc(20px * (var(--anim-frames)));')
    expect(c).toContain('animation: filmstrip calc(var(--anim-steps) * ')
    expect(c).toContain('ms) infinite;')
    // Single steps() run, and a wrap keyframe to the custom-prop end.
    expect(c).toContain('steps(26)')
    expect(c).toContain(
      'to { transform: translateX(calc(var(--anim-frames) * -20px)); }',
    )
  })

  it('matches indicator.css step values for one 60fps pause', () => {
    const frameStepMs = 1000 / 60
    const c = ffc(26, Math.round(26 * frameStepMs), 20, 20, [
      pause('a', 18, Math.round(100 * frameStepMs)),
    ])
    // the two play runs, exactly like indicator.css
    expect(c).toContain('steps(18)')
    expect(c).toContain('steps(8)')
    // the hold keyframe reports the frame and its configured duration
    expect(c).toContain('hold frame 18 for')
    // anim-steps folds in the pause frames
    expect(c).toContain('--anim-steps: 126;') // 26 + 100 pause steps
  })

  it('emits one steps() run per play segment', () => {
    const c = ffc(30, 500, 16, 16, [pause('a', 10, 200), pause('b', 20, 200)])
    // three play runs (0->10, 10->20, 20->30) => three steps() timing functions
    expect((c.match(/steps\(/g) ?? []).length).toBe(3)
    // two holds => two "hold frame" comments
    expect((c.match(/hold frame/g) ?? []).length).toBe(2)
  })
})

describe('computeFirefoxMetadata one-shot (loop = false)', () => {
  it('plays once, rests on the extra final cell, and omits the wrap keyframe', () => {
    const c = computeFirefoxMetadata(26, 433, 20, 16, [], false)
    expect(c).toContain('forwards')
    expect(c).not.toContain('infinite')
    // One extra resting cell in the width.
    expect(c).toContain('width: calc(20px * (var(--anim-frames) + 1));')
    // Rests on the final cell via the element transform, not a `to` keyframe.
    expect(c).toContain(
      'transform: translateX(calc(var(--anim-frames) * -20px));',
    )
    expect(c).not.toContain('to {')
  })
})
