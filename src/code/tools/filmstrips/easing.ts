// Pure easing evaluation for Motion → filmstrip baking. Maps Figma's MotionEasing
// to an eased progress in [0,1] (may overshoot for BACK/spring. intentionally
// NOT clamped so overshoot is preserved). No `figma` dependencies.

import type {
  MotionEasing,
  MotionEasingOrAlias,
  MotionEasingType,
} from './motion-types'

type BezierPoints = readonly [number, number, number, number]

// Cubic-bezier presets. Named Figma presets (GENTLE/QUICK/SLOW) are
// approximations. their exact curves are unpublished.
const BEZIER_PRESETS: Partial<Record<MotionEasingType, BezierPoints>> = {
  EASE_IN: [0.42, 0, 1, 1],
  EASE_OUT: [0, 0, 0.58, 1],
  EASE_IN_AND_OUT: [0.42, 0, 0.58, 1],
  EASE_IN_BACK: [0.36, 0, 0.66, -0.56],
  EASE_OUT_BACK: [0.34, 1.56, 0.64, 1],
  EASE_IN_AND_OUT_BACK: [0.68, -0.6, 0.32, 1.6],
  GENTLE: [0.25, 0.1, 0.25, 1],
  QUICK: [0.4, 0, 0.2, 1],
  SLOW: [0.4, 0, 0.6, 1],
}

// WebKit-style UnitBezier: given input progress x, solve for parameter u then
// return y. Handles control points outside [0,1] (overshoot).
function cubicBezier(p: BezierPoints): (x: number) => number {
  const [x1, y1, x2, y2] = p
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u
  const sampleDerivX = (u: number) => (3 * ax * u + 2 * bx) * u + cx

  const solveX = (x: number): number => {
    let u = x
    // Newton-Raphson
    for (let i = 0; i < 8; i++) {
      const xEval = sampleX(u) - x
      if (Math.abs(xEval) < 1e-6) return u
      const d = sampleDerivX(u)
      if (Math.abs(d) < 1e-6) break
      u -= xEval / d
    }
    // Bisection fallback
    let lo = 0
    let hi = 1
    u = x
    while (lo < hi) {
      const xEval = sampleX(u)
      if (Math.abs(xEval - x) < 1e-6) return u
      if (x > xEval) lo = u
      else hi = u
      u = (hi + lo) / 2
    }
    return u
  }

  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    return sampleY(solveX(x))
  }
}

// Normalized damped-spring unit-step response over t in [0,1]. `bounce` in
// [0,1]: 0 = critically damped (no overshoot), 1 = very bouncy. Approximation
// of Figma's spring settling (duration-independent). flagged to the user.
function springProgress(bounce: number, t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const omega = 10 // natural frequency tuned to settle by t=1
  const zeta = Math.min(Math.max(1 - bounce, 0.05), 1) // damping ratio
  if (zeta >= 1) {
    // Critically damped
    return 1 - Math.exp(-omega * t) * (1 + omega * t)
  }
  const omegaD = omega * Math.sqrt(1 - zeta * zeta)
  const envelope = Math.exp(-zeta * omega * t)
  return (
    1 -
    envelope *
      (Math.cos(omegaD * t) + ((zeta * omega) / omegaD) * Math.sin(omegaD * t))
  )
}

/**
 * Evaluate an easing at normalized segment progress t in [0,1].
 * Returns eased progress (may exceed [0,1] for overshoot easings).
 * VariableAlias-bound easings (no `type`) fall back to linear.
 */
export function evalEasing(
  easing: MotionEasingOrAlias | undefined,
  t: number,
): number {
  if (!easing || !('type' in easing) || easing.type === undefined) return t
  const e = easing as MotionEasing

  switch (e.type) {
    case 'LINEAR':
      return t
    case 'HOLD':
      // Hold the start value until the segment ends.
      return t >= 1 ? 1 : 0
    case 'CUSTOM_CUBIC_BEZIER': {
      const b = e.easingFunctionCubicBezier
      if (!b) return t
      return cubicBezier([b.x1, b.y1, b.x2, b.y2])(t)
    }
    case 'CUSTOM_SPRING':
      return springProgress(e.easingFunctionSpring?.bounce ?? 0.5, t)
    case 'BOUNCY':
      return springProgress(0.5, t)
    default: {
      const preset = BEZIER_PRESETS[e.type]
      return preset ? cubicBezier(preset)(t) : t
    }
  }
}

/** True if this easing is a spring/bouncy type (for surfacing an approximation note). */
export function isSpringEasing(
  easing: MotionEasingOrAlias | undefined,
): boolean {
  if (!easing || !('type' in easing)) return false
  return easing.type === 'CUSTOM_SPRING' || easing.type === 'BOUNCY'
}
