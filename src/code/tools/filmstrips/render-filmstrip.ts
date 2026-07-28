// Tiles N per-frame renders into one wide SVG atlas, one cell per frame. Each
// cell is a nested <svg> viewport, which positions the frame and clips content
// to the cell in the same way the old production strips did.

import { renderFrame, type RenderOptions } from './render-frame'
import { nestedSvg, svgRoot } from './svg/emit'
import { el, type SvgChild } from './svg/node'
import { serialize } from './svg/serialize'
import type { SceneModel } from './build-scene'

/** Optional per-frame progress callback (1-based frame index and total). */
export type FrameProgress = (current: number, total: number) => void

/**
 * Build the full filmstrip SVG. Frame i samples t = (i / frameCount) *
 * durationSec. A looping strip has `frameCount` cells; a one-shot strip appends
 * one more cell for the resting state at t = duration (see below).
 */
export function renderFilmstrip(
  scene: SceneModel,
  durationSec: number,
  frameCount: number,
  cellW: number,
  cellH: number,
  options: RenderOptions,
  loop: boolean,
  onProgress?: FrameProgress,
): string {
  const cells: SvgChild[] = []
  for (let i = 0; i < frameCount; i++) {
    const t = (i / frameCount) * durationSec
    const { nodes, defs } = renderFrame(scene, t, i, options)
    const body = defs.length ? [el('defs', {}, defs), ...nodes] : nodes
    cells.push(nestedSvg(i * cellW, 0, cellW, cellH, body))
    onProgress?.(i + 1, frameCount)
  }
  // One-shot: append the resting frame, the true final state at t = duration
  // (which the [0, duration) loop above never samples), as cell `frameCount`, so
  // the driver can play once and hold it. (frameIndex = frameCount keeps its def
  // ids document-unique.)
  if (!loop) {
    const { nodes, defs } = renderFrame(scene, durationSec, frameCount, options)
    const body = defs.length ? [el('defs', {}, defs), ...nodes] : nodes
    cells.push(nestedSvg(frameCount * cellW, 0, cellW, cellH, body))
  }
  const cellCount = loop ? frameCount : frameCount + 1
  return serialize(svgRoot(cellCount * cellW, cellH, cells))
}
