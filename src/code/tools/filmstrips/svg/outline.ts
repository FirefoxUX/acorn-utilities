// Converts stroked centerlines into filled outline polygons, so the output SVG
// contains only filled paths. Each subpath is flattened to a polyline and offset
// by half the stroke width with @countertype/clipper2-ts (a pure-TypeScript
// Clipper2 port), which resolves self-intersections that a naive offset would
// leave. The offset result is returned as rings of points (straight edges), so
// the caller can serialize compact `M`/`L`/`Z` paths. Used only when the stroke
// output mode is `outline`.

import {
  inflatePathsD,
  JoinType,
  EndType,
  type PathsD,
  type PathD,
} from '@countertype/clipper2-ts'
import type { Cubic, Point, Subpath } from './path-data'
import { installBigIntPolyfill } from './bigint-polyfill'

// clipper2-ts needs a BigInt constructor, which the plugin sandbox omits.
installBigIntPolyfill()

export type StrokeCap = 'butt' | 'round' | 'square'
export type StrokeJoin = 'miter' | 'bevel' | 'round'

export interface OutlineOptions {
  width: number
  cap: StrokeCap
  join: StrokeJoin
  miterLimit: number
}

// Points sampled per cubic when flattening to a polyline. Icon paths are small,
// so a low fixed count stays smooth while keeping the offset output compact.
const SAMPLES_PER_CUBIC = 8
const CLIPPER_PRECISION = 3

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

function flattenToPolyline(subpath: Subpath): PathD {
  const pts: PathD = []
  if (subpath.segments.length === 0) return pts
  pts.push({ ...subpath.segments[0].p0 })
  for (const seg of subpath.segments) {
    for (let k = 1; k <= SAMPLES_PER_CUBIC; k++) {
      pts.push(cubicPoint(seg, k / SAMPLES_PER_CUBIC))
    }
  }
  return pts
}

function joinTypeFor(join: StrokeJoin): JoinType {
  if (join === 'round') return JoinType.Round
  if (join === 'bevel') return JoinType.Bevel
  return JoinType.Miter
}

function endTypeFor(cap: StrokeCap): EndType {
  if (cap === 'round') return EndType.Round
  if (cap === 'square') return EndType.Square
  return EndType.Butt
}

function toPoints(polygon: PathD): Point[] {
  return polygon.map((p) => ({ x: p.x, y: p.y }))
}

/**
 * Outline stroked subpaths into filled polygons that cover the same area an SVG
 * stroke of `width` would paint. Each polygon is a closed ring of points with
 * straight edges. Closed subpaths offset both sides of the loop; open subpaths
 * add caps per `cap`. Returns [] when nothing offsets.
 */
export function outlineStroke(
  subpaths: Subpath[],
  opts: OutlineOptions,
): Point[][] {
  const delta = opts.width / 2
  if (delta <= 0) return []

  const joinType = joinTypeFor(opts.join)
  const result: Point[][] = []

  for (const sp of subpaths) {
    const polyline = flattenToPolyline(sp)
    if (polyline.length < 2) continue
    const endType = sp.closed ? EndType.Joined : endTypeFor(opts.cap)
    let outlined: PathsD
    try {
      outlined = inflatePathsD(
        [polyline],
        delta,
        joinType,
        endType,
        opts.miterLimit,
        CLIPPER_PRECISION,
      )
    } catch {
      continue
    }
    for (const polygon of outlined) {
      if (polygon.length >= 3) result.push(toPoints(polygon))
    }
  }
  return result
}
