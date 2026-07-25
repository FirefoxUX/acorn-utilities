// SVG element builders for the filmstrip engine. Each returns a node in the SVG
// tree (see node.ts); serialize.ts prints the finished tree once. The builders
// own the domain defaults — which attributes to omit (an opacity of 1, an
// identity transform, a nonzero fill-rule) — and the exact attribute order.
// Numbers are rounded here so they enter the tree already formatted.

import { el, type SvgAttrs, type SvgChild, type SvgElement } from './node'
import { round } from './round'

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
export function pathEl(opts: PathElOpts): SvgElement {
  const attrs: SvgAttrs = { d: opts.d }
  if (opts.fill !== undefined) attrs.fill = opts.fill
  if (opts.fillOpacity !== undefined && opts.fillOpacity < 1) {
    attrs['fill-opacity'] = round(opts.fillOpacity)
  }
  if (opts.fillRule && opts.fillRule !== 'nonzero') {
    attrs['fill-rule'] = opts.fillRule
  }
  if (opts.stroke !== undefined) attrs.stroke = opts.stroke
  if (opts.strokeOpacity !== undefined && opts.strokeOpacity < 1) {
    attrs['stroke-opacity'] = round(opts.strokeOpacity)
  }
  if (opts.strokeWidth !== undefined) {
    attrs['stroke-width'] = round(opts.strokeWidth)
  }
  if (opts.strokeLinecap) attrs['stroke-linecap'] = opts.strokeLinecap
  if (opts.strokeLinejoin) attrs['stroke-linejoin'] = opts.strokeLinejoin
  return el('path', attrs)
}

/**
 * Wrap children in a `<g>`, omitting an identity transform or full opacity. When
 * no attribute survives, the children are returned unwrapped (as a sibling list)
 * so no empty `<g>` is ever produced. Emptiness is decided on the built attrs,
 * not on transform/opacity specifically, so a future `<g>` attribute can never be
 * dropped by the unwrap.
 */
export function groupNodes(
  transform: string | null,
  opacity: number | null,
  children: SvgChild[],
): SvgChild[] {
  const attrs: SvgAttrs = {}
  if (transform) attrs.transform = transform
  if (opacity !== null && opacity < 1) attrs.opacity = round(opacity)
  if (Object.keys(attrs).length === 0) return children
  return [el('g', attrs, children)]
}

/**
 * Wrap masked content in a `<g>` carrying a clip-path or mask reference. Unlike
 * `groupNodes`, this always emits the element: the reference is the whole point,
 * so it must never be omitted (a bare identity `<g>` still applies the clip). The
 * wrapper is transform-free — the clip/mask geometry and the masked content are
 * both baked in the same frame space (see render-frame).
 */
export function maskWrapperEl(ref: SvgAttrs, children: SvgChild[]): SvgElement {
  return el('g', ref, children)
}

/** A `<stop>`; omits `stop-opacity` when fully opaque. */
export function stopEl(
  offset: number,
  color: string,
  opacity: number,
): SvgElement {
  const attrs: SvgAttrs = { offset: round(offset), 'stop-color': color }
  if (opacity < 1) attrs['stop-opacity'] = round(opacity)
  return el('stop', attrs)
}

/** A `<linearGradient>` in user space (coordinates match the path `d`). */
export function linearGradientEl(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stops: SvgChild[],
): SvgElement {
  return el(
    'linearGradient',
    {
      id,
      gradientUnits: 'userSpaceOnUse',
      x1: round(x1),
      y1: round(y1),
      x2: round(x2),
      y2: round(y2),
    },
    stops,
  )
}

/**
 * A `<radialGradient>` as a unit circle transformed into the local ellipse.
 * `matrix` maps (origin, r=1) to the ellipse; skew/rotation ride in it because
 * SVG's scalar `r` can't express a non-uniform ellipse.
 */
export function radialGradientEl(
  id: string,
  matrix: string,
  stops: SvgChild[],
): SvgElement {
  return el(
    'radialGradient',
    {
      id,
      gradientUnits: 'userSpaceOnUse',
      cx: 0,
      cy: 0,
      r: 1,
      gradientTransform: matrix,
    },
    stops,
  )
}

/**
 * A `<clipPath>`. Children must be bare shapes — `<g>` is invalid inside — so
 * mask geometry is emitted as `<path transform="matrix(world)" d="…"/>` with no
 * paint (only the outline matters).
 */
export function clipPathEl(id: string, paths: SvgChild[]): SvgElement {
  return el('clipPath', { id }, paths)
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
  content: SvgChild[],
): SvgElement {
  return el(
    'mask',
    {
      id,
      'mask-type': 'alpha',
      maskUnits: 'userSpaceOnUse',
      x: 0,
      y: 0,
      width: round(w),
      height: round(h),
    },
    content,
  )
}

/** A nested `<svg>` viewport that positions and clips one filmstrip cell. */
export function nestedSvg(
  x: number,
  y: number,
  w: number,
  h: number,
  children: SvgChild[],
): SvgElement {
  return el(
    'svg',
    {
      x: round(x),
      y: round(y),
      width: round(w),
      height: round(h),
      viewBox: `0 0 ${round(w)} ${round(h)}`,
    },
    children,
  )
}

/** The outer `<svg>` root for the whole filmstrip. */
export function svgRoot(
  w: number,
  h: number,
  children: SvgChild[],
): SvgElement {
  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: round(w),
      height: round(h),
      viewBox: `0 0 ${round(w)} ${round(h)}`,
    },
    children,
  )
}
