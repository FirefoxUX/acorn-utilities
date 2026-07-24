// Reads and validates pauses persisted on a source frame via plugin data. The
// pause list a designer places on the timeline is stored on the node itself
// (setPluginData in index.ts's save-pauses handler), so regenerating or
// re-importing the same frame restores it. Kept tiny and Figma-typed here; the
// UI never touches plugin data.

import type { StoredPause } from '@tools/filmstrips/types'

/** Plugin-data key holding the JSON-encoded StoredPause[] on a source node. */
export const PAUSES_KEY = 'filmstrip-pauses'

/**
 * Parse the stored pauses off `node`, keeping only entries valid for the
 * current `frameCount`. Out-of-range pauses are dropped, not clamped: clamping
 * would pile distinct pauses onto one frame, which buildSchedule then merges by
 * summing durations. Garbage or missing data yields an empty list.
 */
export function readStoredPauses(
  node: BaseNode,
  frameCount: number,
): StoredPause[] {
  const raw = node.getPluginData(PAUSES_KEY)
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const out: StoredPause[] = []
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue
    const { atFrame, durationMs } = entry as Record<string, unknown>
    if (typeof atFrame !== 'number' || typeof durationMs !== 'number') continue
    const frame = Math.round(atFrame)
    const ms = Math.round(durationMs)
    if (frame < 0 || frame > frameCount - 1 || ms < 1) continue
    out.push({ atFrame: frame, durationMs: ms })
  }
  return out
}
