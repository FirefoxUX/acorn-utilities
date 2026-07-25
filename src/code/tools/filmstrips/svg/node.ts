// A minimal in-memory SVG tree. The engine builds this tree instead of
// concatenating markup, then serialize.ts prints it once — the same shape a
// regular AST generator takes (build nodes, then emit). This SVG subset has no
// text content (path geometry is the `d` attribute), so a node is always an
// element with attributes and element children; there is no text-node kind.
//
// Kept free of any filmstrip knowledge so it can move to a shared layer if a
// second tool ever emits SVG.

/**
 * Attribute values. `undefined`/`null` mean "omit this attribute" — the domain
 * builders use that to drop defaults (e.g. an opacity of 1). Numbers must arrive
 * already rounded; the serializer never rounds.
 */
export type SvgAttrs = Record<string, string | number | undefined | null>

/** An SVG element node. */
export interface SvgElement {
  tag: string
  attrs: SvgAttrs
  children: SvgChild[]
}

/** A node in the tree. Elements only — this subset has no text nodes. */
export type SvgChild = SvgElement

/** Construct an element node. */
export function el(
  tag: string,
  attrs: SvgAttrs,
  children: SvgChild[] = [],
): SvgElement {
  return { tag, attrs, children }
}
