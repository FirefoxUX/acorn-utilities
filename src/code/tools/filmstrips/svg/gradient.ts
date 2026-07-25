// Converts a Figma gradient paint into SVG paint-server geometry in the node's
// LOCAL pixel space (so it lines up with the leaf's path `d`; the per-frame world
// transform on the leaf's <g> then carries both together). Only linear and radial
// are handled — SVG has no conic/diamond paint server.
//
// Figma's `gradientTransform` maps the shape's normalized [0,1]² space into the
// gradient's canonical space. We invert it and sample that canonical space, then
// scale the normalized result by the node's width/height to reach local pixels.
// The radial canonical shape is a unit circle centred at (0.5, 0.5) with radius
// 0.5 — verified against Figma's own SVG export (see gradient.test.ts).

import { invert, applyToPoint, type Affine } from './matrix'

/** Endpoints of a linear gradient in the node's local pixel space. */
export interface LinearHandles {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * The affine that maps a unit circle (origin, r=1) to the radial gradient's
 * ellipse in local pixel space — emitted as the `gradientTransform` on a
 * `<radialGradient cx="0" cy="0" r="1">`. Skew/rotation ride in the matrix
 * because SVG's scalar `r` can't express a non-uniform ellipse.
 */
export type RadialTransform = Affine

/** Linear endpoints from a paint transform. Null if the transform is singular. */
export function linearHandles(
  transform: Affine,
  w: number,
  h: number,
): LinearHandles | null {
  const inv = invert(transform)
  if (!inv) return null
  const p0 = applyToPoint(inv, 0, 0)
  const p1 = applyToPoint(inv, 1, 0)
  return { x1: p0.x * w, y1: p0.y * h, x2: p1.x * w, y2: p1.y * h }
}

/** Radial ellipse transform from a paint transform. Null if singular. */
export function radialTransform(
  transform: Affine,
  w: number,
  h: number,
): RadialTransform | null {
  const inv = invert(transform)
  if (!inv) return null
  const center = applyToPoint(inv, 0.5, 0.5)
  const hx = applyToPoint(inv, 1, 0.5)
  const hy = applyToPoint(inv, 0.5, 1)
  // Radius vectors in local pixels (component-wise, since these are deltas).
  return {
    a: (hx.x - center.x) * w,
    b: (hx.y - center.y) * h,
    c: (hy.x - center.x) * w,
    d: (hy.y - center.y) * h,
    e: center.x * w,
    f: center.y * h,
  }
}
