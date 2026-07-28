// Re-renders a previously generated strip with a Firefox color mapping,
// reusing the cached scene from generate.ts instead of touching Figma again.

import type { ColorMapping } from '@tools/filmstrips/types'
import type { CachedScene } from './generate'
import { renderFilmstrip } from './render-filmstrip'

export function renderWithColorMapping(
  cached: CachedScene,
  mapping: ColorMapping,
): string {
  return renderFilmstrip(
    cached.scene,
    cached.durationSec,
    cached.frameCount,
    cached.cellW,
    cached.cellH,
    { strokeOutput: cached.strokeOutput, colorMapping: mapping },
    cached.loop,
  )
}
