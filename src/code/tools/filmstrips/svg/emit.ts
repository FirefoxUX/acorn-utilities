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

/**
 * Wrap masked content in a `<g>` carrying a clip-path or mask reference. Unlike
 * `groupEl`, this always emits the element: the reference is the whole point, so
 * it must never be omitted (a bare identity `<g>` still applies the clip). The
 * wrapper is transform-free — the clip/mask geometry and the masked content are
 * both baked in the same frame space (see render-frame).
 */
export function maskWrapperEl(refAttr: string, children: string): string {
  return `<g ${refAttr}>${children}</g>`
}

/** A `<stop>`; omits `stop-opacity` when fully opaque. */
export function stopEl(offset: number, color: string, opacity: number): string {
  const op = opacity < 1 ? ` stop-opacity="${round(opacity)}"` : ''
  return `<stop offset="${round(offset)}" stop-color="${color}"${op}/>`
}

/** A `<linearGradient>` in user space (coordinates match the path `d`). */
export function linearGradientEl(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stops: string,
): string {
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}">${stops}</linearGradient>`
}

/**
 * A `<radialGradient>` as a unit circle transformed into the local ellipse.
 * `matrix` maps (origin, r=1) to the ellipse; skew/rotation ride in it because
 * SVG's scalar `r` can't express a non-uniform ellipse.
 */
export function radialGradientEl(
  id: string,
  matrix: string,
  stops: string,
): string {
  return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="${matrix}">${stops}</radialGradient>`
}

/**
 * A `<clipPath>`. Children must be bare shapes — `<g>` is invalid inside — so
 * mask geometry is emitted as `<path transform="matrix(world)" d="…"/>` with no
 * paint (only the outline matters).
 */
export function clipPathEl(id: string, paths: string): string {
  return `<clipPath id="${id}">${paths}</clipPath>`
}

/**
 * An alpha `<mask>` over the full cell. The region is the whole cell rather than
 * the mask's tight bounding box so a mask that scales up under animation is
 * never clipped by its own resting bounds.
 */
export function maskEl(
  id: string,
  w: number,
  h: number,
  content: string,
): string {
  return `<mask id="${id}" mask-type="alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="${round(w)}" height="${round(h)}">${content}</mask>`
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
