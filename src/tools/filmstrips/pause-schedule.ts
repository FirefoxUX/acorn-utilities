// Turns a list of user-placed pauses into an ordered play/hold segment list
// for one loop iteration. Bundle-neutral, pure math (no Svelte/Figma), so it's
// shared by the UI preview builder and the Firefox export comment and unit
// tested in isolation like the other pure engine modules (svg/trim.ts, etc.).
//
// A pause holds the frame already showing once playback reaches `atFrame`,
// then playback resumes toward the next frame. matching Firefox's own model
// (see indicator.css: a pause at frame 18 holds frame 18, then resumes to 26).

/** One user-configured pause. `atFrame` is a real frame index in [0, frameCount-1]. */
export type PausePoint = {
  id: string
  atFrame: number
  durationMs: number
}

/**
 * A contiguous stretch of one loop iteration. `startPct`/`endPct` are offsets
 * in [0,1] within the iteration, usable directly as WAAPI keyframe offsets.
 */
export type Segment =
  | {
      kind: 'play'
      fromFrame: number
      /** Exclusive: the preview shows frames [fromFrame, toFrame); the next
       * segment owns `toFrame`. Can be `frameCount` for the final wrap segment. */
      toFrame: number
      startPct: number
      endPct: number
      /** Frame advance count (toFrame - fromFrame). Export-comment only. this
       * is the `steps(N)` count mirrored into the Firefox comment. The preview
       * builder does NOT read it (it emits one keyframe per frame instead). */
      steps: number
    }
  | {
      kind: 'hold'
      atFrame: number
      startPct: number
      endPct: number
      durationMs: number
      pauseId: string
    }

export type Schedule = {
  segments: Segment[]
  /** One loop iteration in ms: real play time (frameCount * frameStepMs) plus every pause. */
  totalDurationMs: number
}

/**
 * Build the alternating play/hold segment list for one loop iteration.
 * `pauses` need not be sorted; duplicate `atFrame`s merge (durations summed),
 * non-positive durations are dropped, and out-of-range frames are clamped.
 */
export function buildSchedule(
  frameCount: number,
  durationMs: number,
  pauses: readonly PausePoint[],
): Schedule {
  if (frameCount <= 1) {
    return { segments: [], totalDurationMs: durationMs }
  }

  const frameStepMs = durationMs / frameCount

  // Clamp + drop no-op pauses + merge duplicates by frame (first id wins).
  const merged = new Map<number, { durationMs: number; pauseId: string }>()
  for (const p of pauses) {
    if (!(p.durationMs > 0)) continue
    const frame = Math.min(frameCount - 1, Math.max(0, Math.round(p.atFrame)))
    const existing = merged.get(frame)
    if (existing) existing.durationMs += p.durationMs
    else merged.set(frame, { durationMs: p.durationMs, pauseId: p.id })
  }
  const holds = [...merged.entries()]
    .map(([atFrame, v]) => ({ atFrame, ...v }))
    .sort((a, b) => a.atFrame - b.atFrame)

  // First pass: raw ms ranges. Second pass normalizes to pct once total known.
  type Raw =
    | {
        kind: 'play'
        fromFrame: number
        toFrame: number
        steps: number
        startMs: number
        endMs: number
      }
    | {
        kind: 'hold'
        atFrame: number
        durationMs: number
        pauseId: string
        startMs: number
        endMs: number
      }

  const raw: Raw[] = []
  let cursorFrame = 0
  let elapsedMs = 0

  for (const hold of holds) {
    if (hold.atFrame > cursorFrame) {
      const steps = hold.atFrame - cursorFrame
      const startMs = elapsedMs
      elapsedMs += steps * frameStepMs
      raw.push({
        kind: 'play',
        fromFrame: cursorFrame,
        toFrame: hold.atFrame,
        steps,
        startMs,
        endMs: elapsedMs,
      })
      cursorFrame = hold.atFrame
    }
    const startMs = elapsedMs
    elapsedMs += hold.durationMs
    raw.push({
      kind: 'hold',
      atFrame: hold.atFrame,
      durationMs: hold.durationMs,
      pauseId: hold.pauseId,
      startMs,
      endMs: elapsedMs,
    })
  }

  // Final play segment to the wrap position, unless a pause already sits on the
  // last frame (in which case the loop wraps straight from that hold to frame 0).
  const lastHoldAtEnd =
    holds.length > 0 && holds[holds.length - 1].atFrame === frameCount - 1
  if (!lastHoldAtEnd) {
    const steps = frameCount - cursorFrame
    const startMs = elapsedMs
    elapsedMs += steps * frameStepMs
    raw.push({
      kind: 'play',
      fromFrame: cursorFrame,
      toFrame: frameCount,
      steps,
      startMs,
      endMs: elapsedMs,
    })
  }

  const totalDurationMs = elapsedMs
  const norm = totalDurationMs || 1
  const segments: Segment[] = raw.map((r) =>
    r.kind === 'play'
      ? {
          kind: 'play',
          fromFrame: r.fromFrame,
          toFrame: r.toFrame,
          steps: r.steps,
          startPct: r.startMs / norm,
          endPct: r.endMs / norm,
        }
      : {
          kind: 'hold',
          atFrame: r.atFrame,
          durationMs: r.durationMs,
          pauseId: r.pauseId,
          startPct: r.startMs / norm,
          endPct: r.endMs / norm,
        },
  )

  return { segments, totalDurationMs }
}
