// SVG string builders for the filmstrip engine. Rounding and NaN guards live
// here so the markup is compact and never contains invalid numbers.

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

export interface PathElOpts {
  d: string
  fill?: string
  fillOpacity?: number
  fillRule?: 'nonzero' | 'evenodd'
  stroke?: string
  strokeOpacity?: number
  strokeWidth?: number
  strokeLinecap?: string
  strokeLinejoin?: string
}

/** Build a `<path>` element from the given attributes, omitting defaults. */
export function pathEl(opts: PathElOpts): string {
  const attrs: string[] = [`d="${opts.d}"`]
  if (opts.fill !== undefined) attrs.push(`fill="${opts.fill}"`)
  if (opts.fillOpacity !== undefined && opts.fillOpacity < 1) {
    attrs.push(`fill-opacity="${round(opts.fillOpacity)}"`)
  }
  if (opts.fillRule && opts.fillRule !== 'nonzero') {
    attrs.push(`fill-rule="${opts.fillRule}"`)
  }
  if (opts.stroke !== undefined) attrs.push(`stroke="${opts.stroke}"`)
  if (opts.strokeOpacity !== undefined && opts.strokeOpacity < 1) {
    attrs.push(`stroke-opacity="${round(opts.strokeOpacity)}"`)
  }
  if (opts.strokeWidth !== undefined)
    attrs.push(`stroke-width="${round(opts.strokeWidth)}"`)
  if (opts.strokeLinecap) attrs.push(`stroke-linecap="${opts.strokeLinecap}"`)
  if (opts.strokeLinejoin)
    attrs.push(`stroke-linejoin="${opts.strokeLinejoin}"`)
  return `<path ${attrs.join(' ')}/>`
}

/** Wrap children in a `<g>`, omitting an identity transform or full opacity. */
export function groupEl(
  transform: string | null,
  opacity: number | null,
  children: string,
): string {
  const attrs: string[] = []
  if (transform) attrs.push(`transform="${transform}"`)
  if (opacity !== null && opacity < 1) attrs.push(`opacity="${round(opacity)}"`)
  if (attrs.length === 0) return children
  return `<g ${attrs.join(' ')}>${children}</g>`
}

/** A nested `<svg>` viewport that positions and clips one filmstrip cell. */
export function nestedSvg(
  x: number,
  y: number,
  w: number,
  h: number,
  children: string,
): string {
  return `<svg x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" viewBox="0 0 ${round(w)} ${round(h)}">${children}</svg>`
}

/** The outer `<svg>` root for the whole filmstrip. */
export function svgRoot(w: number, h: number, children: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${round(w)}" height="${round(h)}" viewBox="0 0 ${round(w)} ${round(h)}">${children}</svg>`
}
