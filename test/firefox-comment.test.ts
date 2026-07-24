import { describe, it, expect } from 'vitest'
import { computeFirefoxComment } from '../src/tools/filmstrips/firefox-comment'
import type { PausePoint } from '../src/tools/filmstrips/pause-schedule'

function pause(id: string, atFrame: number, durationMs: number): PausePoint {
  return { id, atFrame, durationMs }
}

describe('computeFirefoxComment', () => {
  it('is a valid SVG comment (no nested double-hyphen)', () => {
    const c = computeFirefoxComment(26, 433, 20, 20, [])
    expect(c.startsWith('<!--')).toBe(true)
    expect(c.trimEnd().endsWith('-->')).toBe(true)
    expect(c.slice(4, -3)).not.toContain('--')
  })

  it('emits a runnable CSS block with the sprite dimensions', () => {
    const c = computeFirefoxComment(26, 433, 20, 16, [])
    expect(c).toContain('overflow: hidden;')
    expect(c).toContain('@keyframes filmstrip {')
    expect(c).toContain('animation: filmstrip')
    expect(c).toContain('width: 520px;') // 26 frames * 20px
    expect(c).toContain('height: 16px;')
    // plain loop: a single steps(26) run and a final wrap keyframe
    expect(c).toContain('steps(26)')
    expect(c).toContain('to { transform: translateX(calc(26 * -20px)); }')
  })

  it('matches indicator.css step values for one 60fps pause', () => {
    const frameStepMs = 1000 / 60
    const c = computeFirefoxComment(26, Math.round(26 * frameStepMs), 20, 20, [
      pause('a', 18, Math.round(100 * frameStepMs)),
    ])
    // the two play runs, exactly like indicator.css
    expect(c).toContain('steps(18)')
    expect(c).toContain('steps(8)')
    // step-domain breakpoints: 18/126 and 118/126
    expect(c).toContain('14.29%')
    expect(c).toContain('93.65%')
    // the hold keyframe reports the frame and its configured duration
    expect(c).toContain('hold frame 18 for')
  })

  it('emits one steps() run per play segment', () => {
    const c = computeFirefoxComment(30, 500, 16, 16, [
      pause('a', 10, 200),
      pause('b', 20, 200),
    ])
    // three play runs (0->10, 10->20, 20->30) => three steps() timing functions
    expect((c.match(/steps\(/g) ?? []).length).toBe(3)
    // two holds => two "hold frame" comments
    expect((c.match(/hold frame/g) ?? []).length).toBe(2)
  })
})
