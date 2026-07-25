import { describe, it, expect } from 'vitest'
import { round } from '../src/code/tools/filmstrips/svg/round'
import { toSvgMatrix } from '../src/code/tools/filmstrips/svg/matrix'
import { subpathsToData, type Subpath } from '../src/code/tools/filmstrips/svg/path-data'

describe('round', () => {
  it('rounds to the requested precision', () => {
    expect(round(1.23456, 4)).toBe(1.2346)
    expect(round(1.23456, 3)).toBe(1.235)
    expect(round(1.23456)).toBe(1.235) // default precision 3
  })

  it('maps non-finite values to 0 so invalid tokens never reach output', () => {
    expect(round(NaN)).toBe(0)
    expect(round(Infinity)).toBe(0)
    expect(round(-Infinity)).toBe(0)
  })
})

describe('toSvgMatrix precision', () => {
  it('keeps four decimals so a dropped precision argument fails loudly', () => {
    const m = toSvgMatrix({ a: 1.23456, b: 0, c: 0, d: 1, e: 0, f: 0 })
    expect(m).toBe('matrix(1.2346 0 0 1 0 0)')
  })
})

describe('non-finite hardening in path serialization', () => {
  it('renders a NaN coordinate as 0 rather than the invalid literal "NaN"', () => {
    const bad: Subpath = {
      closed: false,
      segments: [
        {
          p0: { x: NaN, y: 0 },
          c1: { x: 1, y: 1 },
          c2: { x: 2, y: 2 },
          p3: { x: 3, y: 3 },
        },
      ],
    }
    const d = subpathsToData([bad])
    expect(d).not.toContain('NaN')
    expect(d.startsWith('M0 0')).toBe(true)
  })
})
