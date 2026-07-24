// Arc-length tables and De Casteljau splitting for cubic Beziers. Uniform
// parameter sampling approximates arc length, and lengths are cumulative. The
// trim and outline stages use these to map an arc-length fraction to a curve
// parameter and to cut a segment at a parameter value.

import type { Cubic, Point } from './path-data'

/** Sampled arc-length data for one cubic. */
export interface LengthTable {
  /** Curve parameter t at each sample (0..1). */
  ts: number[]
  /** Cumulative arc length at each sample. */
  lengths: number[]
  totalLength: number
}

const DEFAULT_SAMPLES = 150

function cubicPoint(seg: Cubic, t: number): Point {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * seg.p0.x + b * seg.c1.x + c * seg.c2.x + d * seg.p3.x,
    y: a * seg.p0.y + b * seg.c1.y + c * seg.c2.y + d * seg.p3.y,
  }
}

/** Build an arc-length table by sampling the cubic at `samples` uniform t. */
export function cubicLengthTable(
  seg: Cubic,
  samples = DEFAULT_SAMPLES,
): LengthTable {
  const ts: number[] = []
  const lengths: number[] = []
  let total = 0
  let prev = cubicPoint(seg, 0)
  ts.push(0)
  lengths.push(0)
  for (let k = 1; k < samples; k++) {
    const t = k / (samples - 1)
    const pt = cubicPoint(seg, t)
    total += Math.hypot(pt.x - prev.x, pt.y - prev.y)
    ts.push(t)
    lengths.push(total)
    prev = pt
  }
  return { ts, lengths, totalLength: total }
}

/** Map an arc-length fraction (0..1) to a curve parameter t via the table. */
export function arcFractionToT(table: LengthTable, frac: number): number {
  if (frac <= 0 || table.totalLength === 0) return 0
  if (frac >= 1) return 1
  const target = frac * table.totalLength
  const { lengths, ts } = table
  // Linear scan with interpolation between the bracketing samples.
  for (let k = 1; k < lengths.length; k++) {
    if (lengths[k] >= target) {
      const span = lengths[k] - lengths[k - 1]
      const within = span > 0 ? (target - lengths[k - 1]) / span : 0
      return ts[k - 1] + (ts[k] - ts[k - 1]) * within
    }
  }
  return 1
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

// De Casteljau subdivision at t: returns the [0,t] and [t,1] sub-curves.
function subdivide(seg: Cubic, t: number): [Cubic, Cubic] {
  const a = lerp(seg.p0, seg.c1, t)
  const b = lerp(seg.c1, seg.c2, t)
  const c = lerp(seg.c2, seg.p3, t)
  const d = lerp(a, b, t)
  const e = lerp(b, c, t)
  const mid = lerp(d, e, t)
  return [
    { p0: seg.p0, c1: a, c2: d, p3: mid },
    { p0: mid, c1: e, c2: c, p3: seg.p3 },
  ]
}

/** The sub-segment of a cubic between two curve parameters t0 <= t1. */
export function splitCubic(seg: Cubic, t0: number, t1: number): Cubic {
  if (t1 <= 0) return { p0: seg.p0, c1: seg.p0, c2: seg.p0, p3: seg.p0 }
  const left = subdivide(seg, t1)[0]
  if (t0 <= 0) return left
  return subdivide(left, t0 / t1)[1]
}
