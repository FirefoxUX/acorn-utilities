import { describe, it, expect } from 'vitest'
import { formatSvg } from '../src/ui/tools/filmstrips/format-svg'

describe('formatSvg', () => {
  it('indents nested elements one per line', () => {
    const svg =
      '<svg width="40" height="20"><svg x="0" y="0" width="20" height="20"><g transform="matrix(1,0,0,1,0,0)"><path d="M0 0" fill="#000"/></g></svg></svg>'
    expect(formatSvg(svg)).toBe(
      [
        '<svg width="40" height="20">',
        '  <svg x="0" y="0" width="20" height="20">',
        '    <g transform="matrix(1,0,0,1,0,0)">',
        '      <path d="M0 0" fill="#000"/>',
        '    </g>',
        '  </svg>',
        '</svg>',
      ].join('\n'),
    )
  })

  it('keeps a self-closing element on its own line without opening depth', () => {
    const svg = '<svg><path d="M0 0"/><path d="M1 1"/></svg>'
    expect(formatSvg(svg)).toBe(
      ['<svg>', '  <path d="M0 0"/>', '  <path d="M1 1"/>', '</svg>'].join(
        '\n',
      ),
    )
  })

  it('indents a <defs> block and self-closing <use/> references', () => {
    const svg =
      '<svg width="40" height="20"><defs><path id="p0" d="M0 0" fill="#000"/></defs><g transform="translate(1 1)"><use href="#p0"/></g></svg>'
    expect(formatSvg(svg)).toBe(
      [
        '<svg width="40" height="20">',
        '  <defs>',
        '    <path id="p0" d="M0 0" fill="#000"/>',
        '  </defs>',
        '  <g transform="translate(1 1)">',
        '    <use href="#p0"/>',
        '  </g>',
        '</svg>',
      ].join('\n'),
    )
  })

  it('is cosmetic — stripping the added whitespace restores the original', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="20"><svg x="20" y="0" width="20" height="20"><g opacity="0.5"><path d="M2 2" fill="#b3fe00"/></g></svg></svg>'
    expect(formatSvg(svg).replace(/\n\s*/g, '')).toBe(svg)
  })
})
