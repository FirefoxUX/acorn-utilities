import { describe, it, expect } from 'vitest'
import { optimizeSvg } from '../src/ui/tools/filmstrips/optimize-svg'

// The optimizer applies two cosmetic number rewrites after dedup. Apply just
// those to a reference string so equivalence tests can isolate the dedup.
function formatOnly(svg: string): string {
  return svg
    .replace(
      /transform="matrix\(1 0 0 1 ([^)]*)\)"/g,
      'transform="translate($1)"',
    )
    .replace(/(?<=[\s"(,])(-?)0(?=\.\d)/g, '$1')
}

// Expand every <use href="#pN"/> back to its def <path> and drop <defs>, so the
// result can be compared to the pre-optimize markup. This is the losslessness
// proof: dedup must be a pure round-trip.
function expandUses(optimized: string): string {
  const defs = new Map<string, string>()
  const defsBlock = optimized.match(/<defs>([\s\S]*?)<\/defs>/)
  if (defsBlock) {
    for (const [, id, attrs] of defsBlock[1].matchAll(
      /<path id="([^"]+)" ([^>]*?)\/>/g,
    )) {
      defs.set(id, `<path ${attrs}/>`)
    }
  }
  return optimized
    .replace(/<defs>[\s\S]*?<\/defs>/, '')
    .replace(/<use href="#([^"]+)"\/>/g, (m, id) => defs.get(id) ?? m)
}

// A tiny two-frame atlas in the engine's own shape: a static ring repeated in
// both cells (dedup target) plus a per-frame changing path (stays inline).
const ring = '<path d="M0 0C1 1 2 2 3 3Z" fill="none" stroke="context-fill"/>'
function cell(x: number, tx: number, moving: string): string {
  return (
    `<svg x="${x}" y="0" width="20" height="20" viewBox="0 0 20 20">` +
    `<g transform="matrix(1 0 0 1 ${tx} 1)">${ring}</g>` +
    `<g transform="matrix(1 0 0 1 4 5)">${moving}</g>` +
    `</svg>`
  )
}
const atlas =
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" viewBox="0 0 40 20">' +
  cell(0, 1, '<path d="M1 1C2 2 3 3 4 4" fill="#b3fe00"/>') +
  cell(20, 2, '<path d="M5 5C6 6 7 7 8 8" fill="#b3fe00"/>') +
  '</svg>'

describe('optimizeSvg', () => {
  it('is lossless: expanding the uses reproduces the original markup', () => {
    const expanded = expandUses(optimizeSvg(atlas))
    expect(expanded).toBe(formatOnly(atlas))
  })

  it('interns a repeated path into one def referenced by every occurrence', () => {
    const optimized = optimizeSvg(atlas)
    expect((optimized.match(/<defs>/g) ?? []).length).toBe(1)
    // one def for the ring, referenced twice
    expect((optimized.match(/id="p0"/g) ?? []).length).toBe(1)
    expect((optimized.match(/<use href="#p0"\/>/g) ?? []).length).toBe(2)
    // the repeated ring markup no longer appears inline
    expect(optimized).not.toContain(`>${ring}</g>`)
  })

  it('preserves every <g> wrapper (the per-frame transform)', () => {
    const optimized = optimizeSvg(atlas)
    expect((optimized.match(/<g /g) ?? []).length).toBe(
      (atlas.match(/<g /g) ?? []).length,
    )
  })

  it('leaves unique paths inline and emits no <defs> when nothing repeats', () => {
    const unique =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">' +
      '<g transform="matrix(1 0 0 1 1 1)"><path d="M0 0C1 1 2 2 3 3" fill="#000"/></g>' +
      '<g transform="matrix(1 0 0 1 2 2)"><path d="M9 9C8 8 7 7 6 6" fill="#111"/></g>' +
      '</svg>'
    const optimized = optimizeSvg(unique)
    expect(optimized).not.toContain('<defs>')
    expect(optimized).not.toContain('<use')
    expect(optimized).toContain('<path d="M0 0C1 1 2 2 3 3" fill="#000"/>')
  })

  it('does not intern a short path when interning would grow the file', () => {
    // A tiny path repeated twice: def + two <use> would cost more than inline.
    const tiny =
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20">' +
      '<g transform="matrix(1 0 0 1 1 1)"><path d="M0 0" fill="#000"/></g>' +
      '<g transform="matrix(1 0 0 1 2 2)"><path d="M0 0" fill="#000"/></g>' +
      '</svg>'
    const optimized = optimizeSvg(tiny)
    expect(optimized).not.toContain('<defs>')
    expect(
      (optimized.match(/<path d="M0 0" fill="#000"\/>/g) ?? []).length,
    ).toBe(2)
  })

  it('leaves per-cell gradient/mask defs and clip paths intact', () => {
    // A cell carrying its own <defs> (a gradient + a clipPath whose geometry is a
    // transformed <path>) plus a repeated drawn ring. The optimizer must intern
    // the ring but never touch the clip path (it carries a transform) or the
    // gradient/mask defs, and never produce a <use> inside the <clipPath>.
    const clip =
      '<path transform="matrix(1 0 0 1 5 0)" d="M0 0C1 1 2 2 3 3Z"/>'
    const grad =
      '<linearGradient id="f0_0" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="10" y2="0"><stop offset="0" stop-color="#fff"/></linearGradient>'
    const cellWithDefs = (x: number, tx: number): string =>
      `<svg x="${x}" y="0" width="20" height="20" viewBox="0 0 20 20">` +
      `<defs>${grad.replace('f0_0', `f${x}_0`)}<clipPath id="c${x}">${clip}</clipPath></defs>` +
      `<g transform="matrix(1 0 0 1 ${tx} 1)">${ring}</g>` +
      `<g clip-path="url(#c${x})"><g transform="matrix(1 0 0 1 4 5)"><path d="M1 1C2 2 3 3 4 4" fill="url(#f${x}_0)"/></g></g>` +
      `</svg>`
    const masked =
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" viewBox="0 0 40 20">' +
      cellWithDefs(0, 1) +
      cellWithDefs(20, 2) +
      '</svg>'
    const optimized = optimizeSvg(masked)
    // The drawn ring interned; the clip path did not (still inline, twice).
    expect((optimized.match(/<use href="#p0"\/>/g) ?? []).length).toBe(2)
    expect(
      (optimized.match(/transform="translate\(5 0\)" d="M0 0/g) ?? []).length,
    ).toBe(2)
    // No <use> ever appears inside a <clipPath>.
    expect(optimized).not.toMatch(/<clipPath[^>]*><use/)
    // Gradient refs and defs survive untouched.
    expect(optimized).toContain('fill="url(#f0_0)"')
    expect(optimized).toContain('<linearGradient id="f0_0"')
  })

  it('shortens pure-translate matrices and strips redundant leading zeros', () => {
    const optimized = optimizeSvg(atlas)
    expect(optimized).toContain('transform="translate(4 5)"')
    expect(optimized).not.toContain('matrix(1 0 0 1')

    const withZeros =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">' +
      '<g transform="matrix(0 0 0 0 10 10)" opacity="0.5">' +
      '<path d="M10.09 2C3 3 0.5 0.5 4 4" fill="#000"/></g></svg>'
    const out = optimizeSvg(withZeros)
    expect(out).toContain('opacity=".5"') // "0.5" -> ".5"
    expect(out).toContain('matrix(0 0 0 0 10 10)') // not a translate, untouched
    expect(out).toContain('M10.09') // internal digit, not a leading zero
    expect(out).toContain('3 3 .5 .5 4 4') // space-preceded "0.5" -> ".5"
  })
})
