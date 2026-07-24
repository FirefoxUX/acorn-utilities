import { describe, it, expect } from 'vitest'
import { darken } from '../src/ui/lib/color'

// Rec. 601 luma, used only to assert relative brightness in these tests.
function luma(hex: string): number {
  const b = hex.replace(/^#/, '')
  const r = parseInt(b.slice(0, 2), 16)
  const g = parseInt(b.slice(2, 4), 16)
  const bl = parseInt(b.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * bl
}

describe('darken', () => {
  it('returns a full #rrggbb hex', () => {
    expect(darken('#0d99ff', 6)).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('produces a darker color', () => {
    expect(luma(darken('#0d99ff', 6))).toBeLessThan(luma('#0d99ff'))
  })

  it('moves a dark accent visibly (the color-mix bug it replaces did not)', () => {
    // #046000 is dark; a proportional mix toward black barely shifts it. A fixed
    // lightness drop must still lower luma by a noticeable margin.
    const before = luma('#046000')
    const after = luma(darken('#046000', 11))
    expect(before - after).toBeGreaterThan(5)
  })

  it('darkens more for a larger step (active is darker than hover)', () => {
    expect(luma(darken('#5b1031', 11))).toBeLessThan(luma(darken('#5b1031', 6)))
  })

  it('preserves hue and saturation, only dropping lightness', () => {
    // Pure blue stays on the blue channel after darkening.
    const out = darken('#0000ff', 20)
    const r = parseInt(out.slice(1, 3), 16)
    const g = parseInt(out.slice(3, 5), 16)
    const b = parseInt(out.slice(5, 7), 16)
    expect(r).toBe(0)
    expect(g).toBe(0)
    expect(b).toBeGreaterThan(0)
    expect(b).toBeLessThan(255)
  })

  it('clamps at black instead of going negative', () => {
    expect(darken('#000000', 20)).toBe('#000000')
  })

  it('accepts shorthand hex', () => {
    expect(luma(darken('#fff', 10))).toBeLessThan(luma('#ffffff'))
  })

  it('returns unknown formats unchanged', () => {
    expect(darken('rebeccapurple', 10)).toBe('rebeccapurple')
    expect(darken('rgb(1,2,3)', 10)).toBe('rgb(1,2,3)')
  })
})
