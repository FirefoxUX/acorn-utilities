import { describe, it, expect } from 'vitest'
import { el } from '../src/code/tools/filmstrips/svg/node'
import { serialize } from '../src/code/tools/filmstrips/svg/serialize'

describe('serialize', () => {
  it('self-closes a childless element with no space before the slash', () => {
    expect(serialize(el('path', { d: 'M0 0' }))).toBe('<path d="M0 0"/>')
  })

  it('wraps children and emits a closing tag', () => {
    const tree = el('g', { opacity: 0.5 }, [el('path', { d: 'M0 0' })])
    expect(serialize(tree)).toBe('<g opacity="0.5"><path d="M0 0"/></g>')
  })

  it('emits an empty-attribute element with no trailing space', () => {
    expect(serialize(el('defs', {}, [el('path', { d: 'M0 0' })]))).toBe(
      '<defs><path d="M0 0"/></defs>',
    )
    // And childless with no attrs still self-closes cleanly.
    expect(serialize(el('defs', {}))).toBe('<defs/>')
  })

  it('drops only strictly null/undefined attributes, keeping 0 and ""', () => {
    const node = el('rect', {
      x: 0,
      y: '',
      width: undefined,
      height: null,
      fill: 'none',
    })
    expect(serialize(node)).toBe('<rect x="0" y="" fill="none"/>')
  })

  it('escapes & < > " but leaves # ( ) \' intact', () => {
    const node = el('path', {
      fill: 'url(#a)',
      'data-x': `a & b < c > d " e ' f`,
    })
    expect(serialize(node)).toBe(
      `<path fill="url(#a)" data-x="a &amp; b &lt; c &gt; d &quot; e ' f"/>`,
    )
  })

  it('does not double-escape an existing entity', () => {
    // The raw & is escaped once; the surrounding text is untouched.
    expect(serialize(el('t', { v: '&amp;' }))).toBe('<t v="&amp;amp;"/>')
  })

  it('stringifies numbers with the JS default, never padding decimals', () => {
    const node = el('a', { m: 10, n: 0.5, z: 0 })
    expect(serialize(node)).toBe('<a m="10" n="0.5" z="0"/>')
  })

  it('serializes a sibling list with no separator', () => {
    const nodes = [el('path', { d: 'A' }), el('path', { d: 'B' })]
    expect(serialize(nodes)).toBe('<path d="A"/><path d="B"/>')
  })

  it('preserves attribute insertion order', () => {
    const node = el('path', { d: 'M0 0', fill: 'red', stroke: 'blue' })
    expect(serialize(node)).toBe('<path d="M0 0" fill="red" stroke="blue"/>')
  })
})
