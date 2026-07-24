// Parses the SVG-subset path strings Figma returns (VectorPath.data, absolute
// M/L/Q/C/Z) into cubic-only subpaths, and serializes them back. L and Q are
// promoted to cubics so the length, trim, and outline math work on one segment
// type. Closed subpaths are normalized so their segments form the full loop.

export interface Point {
  x: number
  y: number
}

/** A cubic Bezier segment with absolute control points. */
export interface Cubic {
  p0: Point
  c1: Point
  c2: Point
  p3: Point
}

/** A run of connected cubics. `closed` marks a path that returns to its start. */
export interface Subpath {
  closed: boolean
  segments: Cubic[]
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function lineToCubic(p0: Point, p3: Point): Cubic {
  return {
    p0,
    c1: lerpPoint(p0, p3, 1 / 3),
    c2: lerpPoint(p0, p3, 2 / 3),
    p3,
  }
}

function quadraticToCubic(p0: Point, qc: Point, p3: Point): Cubic {
  return {
    p0,
    c1: {
      x: p0.x + (2 / 3) * (qc.x - p0.x),
      y: p0.y + (2 / 3) * (qc.y - p0.y),
    },
    c2: {
      x: p3.x + (2 / 3) * (qc.x - p3.x),
      y: p3.y + (2 / 3) * (qc.y - p3.y),
    },
    p3,
  }
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6
}

// Split a path string into command letters and numeric tokens.
function tokenize(data: string): string[] {
  const tokens = data.match(/[MLQCZmlqcz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi)
  return tokens ?? []
}

/**
 * Parse an absolute-command SVG path string into cubic-only subpaths.
 * Unknown commands are skipped rather than throwing, so a malformed leaf
 * renders nothing instead of aborting a frame.
 */
export function parsePath(data: string): Subpath[] {
  const tokens = tokenize(data)
  const subpaths: Subpath[] = []

  let current: Subpath | null = null
  let start: Point = { x: 0, y: 0 }
  let cursor: Point = { x: 0, y: 0 }
  let i = 0

  const num = () => parseFloat(tokens[i++])
  const flush = () => {
    if (current && current.segments.length > 0) subpaths.push(current)
    current = null
  }

  while (i < tokens.length) {
    const cmd = tokens[i++]
    switch (cmd) {
      case 'M': {
        flush()
        start = { x: num(), y: num() }
        cursor = start
        current = { closed: false, segments: [] }
        // Extra coordinate pairs after M are implicit line-to commands.
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const p3 = { x: num(), y: num() }
          current.segments.push(lineToCubic(cursor, p3))
          cursor = p3
        }
        break
      }
      case 'L': {
        if (!current) break
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const p3 = { x: num(), y: num() }
          current.segments.push(lineToCubic(cursor, p3))
          cursor = p3
        }
        break
      }
      case 'C': {
        if (!current) break
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const c1 = { x: num(), y: num() }
          const c2 = { x: num(), y: num() }
          const p3 = { x: num(), y: num() }
          current.segments.push({ p0: cursor, c1, c2, p3 })
          cursor = p3
        }
        break
      }
      case 'Q': {
        if (!current) break
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const qc = { x: num(), y: num() }
          const p3 = { x: num(), y: num() }
          current.segments.push(quadraticToCubic(cursor, qc, p3))
          cursor = p3
        }
        break
      }
      case 'Z':
      case 'z': {
        if (current) {
          // Normalize: append the closing segment when the last point does not
          // already return to the start, so segments form the full loop.
          if (current.segments.length > 0 && !samePoint(cursor, start)) {
            current.segments.push(lineToCubic(cursor, start))
          }
          current.closed = true
          cursor = start
          flush()
        }
        break
      }
      default:
        // Skip unrecognized tokens.
        break
    }
  }
  flush()
  return subpaths
}

/**
 * Serialize closed polygons (rings of points) to an SVG path string using
 * straight `M`/`L`/`Z` commands. Used for offset stroke outlines, whose edges
 * are straight; emitting lines instead of cubics keeps the markup small.
 */
export function polygonsToData(polygons: Point[][], precision = 3): string {
  const r = (n: number) => {
    const f = 10 ** precision
    return String(Math.round(n * f) / f)
  }
  const parts: string[] = []
  for (const poly of polygons) {
    if (poly.length < 3) continue
    parts.push(`M${r(poly[0].x)} ${r(poly[0].y)}`)
    for (let i = 1; i < poly.length; i++) {
      parts.push(`L${r(poly[i].x)} ${r(poly[i].y)}`)
    }
    parts.push('Z')
  }
  return parts.join('')
}

/** Serialize subpaths to an SVG path string (M, a C per segment, Z if closed). */
export function subpathsToData(subpaths: Subpath[], precision = 3): string {
  const r = (n: number) => {
    const f = 10 ** precision
    return String(Math.round(n * f) / f)
  }
  const parts: string[] = []
  for (const sp of subpaths) {
    if (sp.segments.length === 0) continue
    const first = sp.segments[0].p0
    parts.push(`M${r(first.x)} ${r(first.y)}`)
    for (const seg of sp.segments) {
      parts.push(
        `C${r(seg.c1.x)} ${r(seg.c1.y)} ${r(seg.c2.x)} ${r(seg.c2.y)} ${r(seg.p3.x)} ${r(seg.p3.y)}`,
      )
    }
    if (sp.closed) parts.push('Z')
  }
  return parts.join('')
}
