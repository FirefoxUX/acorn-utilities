// Tiles N per-frame renders into one wide SVG atlas, one cell per frame. Each
// cell is a nested <svg> viewport, which positions the frame and clips content
// to the cell in the same way the old production strips did.

import { renderFrame, type RenderOptions } from './render-frame'
import { nestedSvg, svgRoot } from './svg/emit'
import type { SceneModel } from './build-scene'

/** Optional per-frame progress callback (1-based frame index and total). */
export type FrameProgress = (current: number, total: number) => void

/**
 * Build the full filmstrip SVG. Frame i samples t = (i / frameCount) *
 * durationSec, matching the CSS steps(N, start) loop the tool emits.
 */
export function renderFilmstrip(
  scene: SceneModel,
  durationSec: number,
  frameCount: number,
  cellW: number,
  cellH: number,
  options: RenderOptions,
  onProgress?: FrameProgress,
): string {
  const cells: string[] = []
  for (let i = 0; i < frameCount; i++) {
    const t = (i / frameCount) * durationSec
    const inner = renderFrame(scene, t, options)
    cells.push(nestedSvg(i * cellW, 0, cellW, cellH, inner))
    onProgress?.(i + 1, frameCount)
  }
  return svgRoot(cellW * frameCount, cellH, cells.join(''))
}
