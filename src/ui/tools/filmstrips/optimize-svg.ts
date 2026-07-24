// Shrinks a filmstrip SVG for download by interning duplicated <path> elements
// into <defs> and referencing them with <use> — the same structure Firefox's
// own icon strips use. The engine re-serializes every leaf's full path data for
// each frame, so static leaves and settled-identical frames repeat the same
// markup many times; hoisting each duplicate to one def and replacing every
// occurrence with `<use href>` roughly halves the file.
//
// This is lossless: the positioning `<g transform opacity>` wrappers are left
// untouched and each `<use>` expands back to the exact path it replaced (a
// two-path leaf just becomes two `<use>` in the same `<g>`). Keying on the whole
// path element, not just `d`, means two paths share a def only when every paint
// attribute matches, so the `<use>` carries nothing but the href.
//
// Runs on the download copy only (see DoneView), so the preview, the backend
// render, and Place in Figma are unaffected. Output is export-only and is not
// round-tripped back through the plugin's importer.

const PATH_RE = /<path [^>]*?\/>/g

export function optimizeSvg(svg: string): string {
  // Count identical <path> markup, remembering first-encounter order so ids are
  // stable across runs (readable diffs).
  const counts = new Map<string, number>()
  const order: string[] = []
  for (const [match] of svg.matchAll(PATH_RE)) {
    const n = counts.get(match) ?? 0
    if (n === 0) order.push(match)
    counts.set(match, n + 1)
  }

  // Intern only when it actually saves bytes: a short path repeated twice can
  // cost more as a def + two `<use>` than it does left inline.
  const idFor = new Map<string, string>()
  const defs: string[] = []
  let idx = 0
  for (const path of order) {
    const count = counts.get(path) ?? 0
    if (count < 2) continue
    const id = `p${idx.toString(36)}`
    const def = path.replace(/^<path /, `<path id="${id}" `)
    const use = `<use href="#${id}"/>`
    if (count * path.length <= def.length + count * use.length) continue
    idFor.set(path, id)
    defs.push(def)
    idx++
  }

  if (defs.length === 0) return formatNumbers(svg)

  // Replace every interned occurrence with its `<use>`; leave the surrounding
  // wrappers and any non-interned path exactly as-is.
  let out = svg.replace(PATH_RE, (m) => {
    const id = idFor.get(m)
    return id ? `<use href="#${id}"/>` : m
  })

  // Insert the shared shapes right after the opening root <svg …> (the first
  // match; nested cell <svg> elements keep referencing the root defs by id).
  out = out.replace(/<svg\b[^>]*>/, (m) => `${m}<defs>${defs.join('')}</defs>`)

  return formatNumbers(out)
}

// Cosmetic number tightening, applied after dedup so it never changes an
// interning key. Both rewrites are scoped so they cannot touch integers, hex
// colors, or context-* paints: the matrix rewrite is anchored to a transform
// value and only fires on a pure translate, and the leading-zero strip matches
// a standalone `0` before `.digit` (so `10.09` and `matrix(0 0 0 0 …)` are left
// alone).
function formatNumbers(svg: string): string {
  return svg
    .replace(
      /transform="matrix\(1 0 0 1 ([^)]*)\)"/g,
      'transform="translate($1)"',
    )
    .replace(/(?<=[\s"(,])(-?)0(?=\.\d)/g, '$1')
}
