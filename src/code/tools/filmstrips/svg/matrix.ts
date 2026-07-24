// 2x3 affine transforms for the filmstrip SVG engine. The field layout matches
// Figma's Transform ([[a,c,e],[b,d,f]]): a point (x,y) maps to
// (a*x + c*y + e, b*x + d*y + f). `multiply(m1, m2)` applies m2 then m1.

import type { Pose } from '../interpolate'

export interface Affine {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export function identity(): Affine {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
}

export function translate(tx: number, ty: number): Affine {
  return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty }
}

export function scale(sx: number, sy: number): Affine {
  return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 }
}

/** Rotation in Figma's convention: R(θ)=[[cosθ,sinθ],[-sinθ,cosθ]], θ radians. */
export function rotate(rad: number): Affine {
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { a: cos, b: -sin, c: sin, d: cos, e: 0, f: 0 }
}

/** m1 applied after m2 (m1 * m2). */
export function multiply(m1: Affine, m2: Affine): Affine {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  }
}

/** Left-to-right composition: compose(a, b, c) = a * b * c. */
export function compose(...mats: Affine[]): Affine {
  return mats.reduce((acc, m) => multiply(acc, m))
}

/** Read a Figma Transform ([[a,c,e],[b,d,f]]) into an Affine. */
export function fromFigmaTransform(t: Transform): Affine {
  return {
    a: t[0][0],
    c: t[0][1],
    e: t[0][2],
    b: t[1][0],
    d: t[1][1],
    f: t[1][2],
  }
}

/** Apply an affine to a point. */
export function applyToPoint(
  m: Affine,
  x: number,
  y: number,
): { x: number; y: number } {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }
}

/** Serialize to an SVG `matrix(a,b,c,d,e,f)` string. */
export function toSvgMatrix(m: Affine, precision = 4): string {
  const f = 10 ** precision
  const r = (n: number) => Math.round(n * f) / f
  return `matrix(${r(m.a)} ${r(m.b)} ${r(m.c)} ${r(m.d)} ${r(m.e)} ${r(m.f)})`
}

/**
 * Layer a pose's animated transform onto a resting matrix, rotating and scaling
 * about the node's own center. `w`/`h` are the node's dimensions. Translation is
 * added in the node's local space, so the result keeps the resting placement.
 */
export function composePose(
  baseline: Affine,
  pose: Pose,
  w: number,
  h: number,
): Affine {
  const cx = w / 2
  const cy = h / 2
  const tx = pose.translateX ?? 0
  const ty = pose.translateY ?? 0
  const sx = pose.scaleX ?? 1
  const sy = pose.scaleY ?? 1
  const rad = ((pose.rotation ?? 0) * Math.PI) / 180
  const local = compose(
    translate(tx, ty),
    translate(cx, cy),
    rotate(rad),
    scale(sx, sy),
    translate(-cx, -cy),
  )
  return multiply(baseline, local)
}
