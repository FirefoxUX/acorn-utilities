// Path-trim (the draw-on / stroke-reveal effect) for cubic subpaths. Given a
// start, end, and offset as fractions of total arc length, it returns the kept
// portion as new subpaths, splitting the cubics at the window boundaries. The
// algorithm follows lottie-web's TrimModifier, adapted to absolute cubic data.

import type { Cubic, Subpath } from './path-data'
import {
  cubicLengthTable,
  arcFractionToT,
  splitCubic,
  type LengthTable,
} from './bezier'

// Below this kept length a round or square cap would render as a dot at the
// draw-on boundary, so the stroke is dropped for that frame instead.
const MIN_VISIBLE_PX = 0.5
const VISIBLE_WIDTH_FRAC = 0.02

interface SegmentInfo {
  seg: Cubic
  table: LengthTable
  /** Index of the source subpath this segment belongs to. */
  subpathIndex: number
}

// A half-open absolute-length window [lo, hi).
interface Window {
  lo: number
  hi: number
}

function buildSegmentInfos(subpaths: Subpath[]): {
  segments: SegmentInfo[]
  total: number
} {
  const segments: SegmentInfo[] = []
  let total = 0
  subpaths.forEach((sp, subpathIndex) => {
    for (const seg of sp.segments) {
      const table = cubicLengthTable(seg)
      segments.push({ seg, table, subpathIndex })
      total += table.totalLength
    }
  })
  return { segments, total }
}

// Walk one absolute window, returning kept cubics grouped by contiguity. A new
// group starts at a source-subpath boundary or after a skipped gap.
function walkWindow(
  segments: SegmentInfo[],
  win: Window,
): { groups: Cubic[][]; keptLength: number } {
  const groups: Cubic[][] = []
  let group: Cubic[] = []
  let lastSubpath = -1
  let acc = 0
  let keptLength = 0

  const flush = () => {
    if (group.length) groups.push(group)
    group = []
  }

  for (const info of segments) {
    const segLen = info.table.totalLength
    const segStart = acc
    const segEnd = acc + segLen
    acc = segEnd

    if (segLen === 0) continue
    if (segEnd <= win.lo || segStart >= win.hi) {
      flush()
      continue
    }
    if (info.subpathIndex !== lastSubpath) {
      flush()
      lastSubpath = info.subpathIndex
    }

    const a =
      win.lo > segStart
        ? arcFractionToT(info.table, (win.lo - segStart) / segLen)
        : 0
    const b =
      win.hi < segEnd
        ? arcFractionToT(info.table, (win.hi - segStart) / segLen)
        : 1
    group.push(a > 0 || b < 1 ? splitCubic(info.seg, a, b) : info.seg)
    keptLength += Math.min(win.hi, segEnd) - Math.max(win.lo, segStart)
  }
  flush()
  return { groups, keptLength }
}

/**
 * Trim subpaths to the arc-length window [start, end] shifted by offset. All
 * three are fractions in 0..1 (offset wraps). When start > end they are
 * swapped. Returns [] when the total kept length is below the cap-bloom epsilon
 * for the given stroke width, so a cap cannot render as a dot.
 */
export function trimSubpaths(
  subpaths: Subpath[],
  start: number,
  end: number,
  offset: number,
  strokeWidth: number,
): Subpath[] {
  let s = Math.min(Math.max(start, 0), 1)
  let e = Math.min(Math.max(end, 0), 1)
  const o = ((offset % 1) + 1) % 1

  if (s === e) return []
  if (s > e) {
    const tmp = s
    s = e
    e = tmp
  }
  if (s === 0 && e === 1 && o === 0) return subpaths

  s += o
  e += o

  const { segments, total } = buildSegmentInfos(subpaths)
  if (total === 0) return []

  // Split the (possibly wrapped) fractional window into absolute-length windows.
  const windows: Window[] = []
  if (e <= 1) {
    windows.push({ lo: s * total, hi: e * total })
  } else if (s >= 1) {
    windows.push({ lo: (s - 1) * total, hi: (e - 1) * total })
  } else {
    windows.push({ lo: s * total, hi: total })
    windows.push({ lo: 0, hi: (e - 1) * total })
  }

  const result: Subpath[] = []
  let keptLength = 0
  for (const win of windows) {
    const { groups, keptLength: kept } = walkWindow(segments, win)
    keptLength += kept
    for (const group of groups) {
      result.push({ closed: false, segments: group })
    }
  }

  const epsilon = Math.max(MIN_VISIBLE_PX, VISIBLE_WIDTH_FRAC * strokeWidth)
  if (keptLength < epsilon) return []
  return result
}
