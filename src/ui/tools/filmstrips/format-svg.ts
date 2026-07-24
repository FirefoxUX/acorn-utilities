// Pretty-print machine-generated SVG (nested <svg>/<g>/<path>) as one element
// per line, indented by nesting depth. The engine emits everything on a single
// line, which is fine for the browser and Figma but hard to read or diff once
// downloaded. Only breaks between adjacent tags (`><`), so it never splits text
// that sits between an open and close tag (our atlas has none, but this keeps
// it safe for arbitrary exported SVG too).

export function formatSvg(svg: string): string {
  const lines = svg.replace(/></g, '>\n<').split('\n')
  const out: string[] = []
  let depth = 0
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('</')) depth = Math.max(0, depth - 1)
    out.push('  '.repeat(depth) + line)
    const opensChild =
      line.startsWith('<') &&
      !line.startsWith('</') &&
      !line.startsWith('<!') && // comment / doctype
      !line.startsWith('<?') && // xml declaration
      !line.endsWith('/>') && // self-closing
      !/<\/[A-Za-z]/.test(line) // opened and closed on the same line
    if (opensChild) depth++
  }
  return out.join('\n')
}
