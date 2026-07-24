// Orchestrates the SVG filmstrip engine: builds a static scene from the
// selection and renders every frame to a tiled, literal-color SVG atlas.
// Reads Figma geometry; never mutates the source. The built scene is handed
// back too, so the backend can re-render a Firefox color mapping on demand
// (see render-context.ts) without re-reading Figma geometry, and placing the
// result on the canvas is a separate, later action (see place-in-figma.ts).

import type { FilmstripOptions } from '@tools/filmstrips/types'
import { FILMSTRIP_FPS, MAX_FILMSTRIP_FRAMES } from '@tools/filmstrips/types'
import { collectAnimated, subtreeDurationSec } from './inspect'
import { buildScene, type SceneModel } from './build-scene'
import { collectColors } from './collect-colors'
import { renderFilmstrip } from './render-filmstrip'

export interface FilmstripData {
  svg: string
  colors: string[]
  width: number
  height: number
  cellW: number
  cellH: number
  frameCount: number
  durationMs: number
  sourceName: string
}

/** Enough to re-render the same strip with a different color mapping. */
export interface CachedScene {
  scene: SceneModel
  durationSec: number
  frameCount: number
  cellW: number
  cellH: number
  strokeOutput: 'stroke' | 'outline'
}

type ProgressCallback = (current: number, total: number) => void

export async function generateFilmstrip(
  source: SceneNode,
  options: FilmstripOptions,
  onProgress: ProgressCallback,
): Promise<{ data: FilmstripData; cached: CachedScene }> {
  const animated = collectAnimated(source)
  if (animated.length === 0) {
    throw new Error('The selected frame has no Figma Motion animation.')
  }

  const durationSec = subtreeDurationSec(source, animated)
  if (durationSec <= 0) {
    throw new Error('Could not determine the animation duration.')
  }

  let frameCount = Math.max(2, Math.ceil(durationSec * FILMSTRIP_FPS))
  if (frameCount > MAX_FILMSTRIP_FRAMES) frameCount = MAX_FILMSTRIP_FRAMES

  const cellW = Math.max(1, Math.round(source.width))
  const cellH = Math.max(1, Math.round(source.height))

  // Let the processing view paint before the synchronous render.
  await new Promise((resolve) => setTimeout(resolve, 0))

  const scene = buildScene(source)
  const svg = renderFilmstrip(
    scene,
    durationSec,
    frameCount,
    cellW,
    cellH,
    { strokeOutput: options.strokeOutput, colorMapping: null },
    onProgress,
  )

  return {
    data: {
      svg,
      colors: collectColors(scene),
      width: cellW * frameCount,
      height: cellH,
      cellW,
      cellH,
      frameCount,
      durationMs: Math.round(durationSec * 1000),
      sourceName: source.name,
    },
    cached: {
      scene,
      durationSec,
      frameCount,
      cellW,
      cellH,
      strokeOutput: options.strokeOutput,
    },
  }
}
