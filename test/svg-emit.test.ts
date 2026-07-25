import { describe, it, expect } from 'vitest'
import { pathEl, groupNodes, stopEl } from '../src/code/tools/filmstrips/svg/emit'
import { el } from '../src/code/tools/filmstrips/svg/node'
import { serialize } from '../src/code/tools/filmstrips/svg/serialize'

describe('groupNodes', () => {
  it('returns children unwrapped when no attribute survives', () => {
    const children = [el('path', { d: 'M0 0' })]
    // Identity transform (null) and full opacity: nothing to wrap.
    expect(groupNodes(null, 1, children)).toBe(children)
    expect(groupNodes(null, null, children)).toBe(children)
  })

  it('wraps in a single <g> when a transform or partial opacity is present', () => {
    const children = [el('path', { d: 'M0 0' })]
    expect(serialize(groupNodes('matrix(1 0 0 1 5 0)', 1, children))).toBe(
      '<g transform="matrix(1 0 0 1 5 0)"><path d="M0 0"/></g>',
    )
    expect(serialize(groupNodes(null, 0.5, children))).toBe(
      '<g opacity="0.5"><path d="M0 0"/></g>',
    )
  })
})

describe('pathEl', () => {
  it('keeps attribute order and omits defaults', () => {
    // fill-opacity >= 1 and fill-rule nonzero are defaults, so both are omitted.
    const node = pathEl({
      d: 'M0 0',
      fill: '#ff0000',
      fillOpacity: 1,
      fillRule: 'nonzero',
    })
    expect(serialize(node)).toBe('<path d="M0 0" fill="#ff0000"/>')
  })

  it('emits fill-opacity below 1 and a non-default fill-rule', () => {
    const node = pathEl({
      d: 'M0 0',
      fill: '#ff0000',
      fillOpacity: 0.5,
      fillRule: 'evenodd',
    })
    expect(serialize(node)).toBe(
      '<path d="M0 0" fill="#ff0000" fill-opacity="0.5" fill-rule="evenodd"/>',
    )
  })

  it('orders stroke attributes after fill attributes', () => {
    const node = pathEl({
      d: 'M0 0',
      fill: 'none',
      stroke: '#000000',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    })
    expect(serialize(node)).toBe(
      '<path d="M0 0" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    )
  })
})

describe('stopEl', () => {
  it('omits stop-opacity when fully opaque', () => {
    expect(serialize(stopEl(0, '#ffffff', 1))).toBe(
      '<stop offset="0" stop-color="#ffffff"/>',
    )
  })

  it('emits stop-opacity below 1', () => {
    expect(serialize(stopEl(1, '#0000ff', 0.5))).toBe(
      '<stop offset="1" stop-color="#0000ff" stop-opacity="0.5"/>',
    )
  })
})
