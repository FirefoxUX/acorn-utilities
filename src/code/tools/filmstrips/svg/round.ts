// Shared numeric and color formatting for the SVG engine. One rounding function
// so path data, matrices, and element attributes never diverge on precision or
// on how a non-finite value is handled. Kept free of any filmstrip knowledge so
// it can move to a shared layer if a second tool ever emits SVG.

/**
 * Round to `precision` decimals, mapping any non-finite value to 0. The guard
 * matters because a NaN or Infinity coordinate would otherwise serialize as the
 * literal token "NaN"/"Infinity", which is invalid SVG.
 */
export function round(n: number, precision = 3): number {
  if (!Number.isFinite(n)) return 0
  const f = 10 ** precision
  return Math.round(n * f) / f
}

/** Format an RGB channel triple (0..1) as an "#rrggbb" string. */
export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => {
    const n = Math.round(Math.min(1, Math.max(0, v)) * 255)
    return n.toString(16).padStart(2, '0')
  }
  return `#${c(r)}${c(g)}${c(b)}`
}
