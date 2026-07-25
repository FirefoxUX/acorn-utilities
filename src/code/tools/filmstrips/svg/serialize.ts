// Prints an SVG node tree to a single-line string. This is the one place markup
// is produced, so escaping and attribute omission are consistent everywhere.
//
// Rules that matter for correctness:
// - An attribute is dropped only when its value is strictly null/undefined, so a
//   real 0 or "" (e.g. x="0", offset="0") always survives.
// - Numbers are stringified with the JS default (String), never toFixed — values
//   arrive already rounded from the builders, so no formatting happens here.
// - A childless element self-closes as <tag .../> with no space before the slash.

import type { SvgAttrs, SvgChild, SvgElement } from './node'

// Escape the four characters that would break an attribute value. `&` must go
// first so the entities we introduce are not re-escaped. `#`, `'`, `(`, `)` are
// intentionally left intact — url(#id), context-* paints, and matrices rely on
// them.
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function serializeAttrs(attrs: SvgAttrs): string {
  let out = ''
  for (const key of Object.keys(attrs)) {
    const value = attrs[key]
    if (value === undefined || value === null) continue
    out += ` ${key}="${escapeAttr(String(value))}"`
  }
  return out
}

function serializeElement(node: SvgElement): string {
  const open = `<${node.tag}${serializeAttrs(node.attrs)}`
  if (node.children.length === 0) return `${open}/>`
  return `${open}>${serializeChildren(node.children)}</${node.tag}>`
}

function serializeChildren(nodes: SvgChild[]): string {
  let out = ''
  for (const child of nodes) out += serializeElement(child)
  return out
}

/** Serialize a node or a sibling list to a single-line SVG string. */
export function serialize(input: SvgChild | SvgChild[]): string {
  return Array.isArray(input)
    ? serializeChildren(input)
    : serializeElement(input)
}
