// Treats the selected node as an already-baked filmstrip: exports it as-is
// and slices its width into `frameCount` equal cells. There's no Motion
// timeline to read a duration from, so playback duration is derived assuming
// the same fixed FPS used when generating strips. The original paints can't
// be split back into fill vs. stroke, so no Firefox color mapping is possible
// for imported strips (`colors: null`).

import { FILMSTRIP_FPS } from '@tools/filmstrips/types'
import type { FilmstripData } from './generate'

export async function importStrip(
  source: SceneNode,
  frameCount: number,
): Promise<Omit<FilmstripData, 'colors'> & { colors: null }> {
  if (frameCount < 2) {
    throw new Error('A filmstrip needs at least 2 frames.')
  }

  const cellW = Math.max(1, Math.round(source.width / frameCount))
  const cellH = Math.max(1, Math.round(source.height))
  const svg = await source.exportAsync({ format: 'SVG_STRING' })

  return {
    svg,
    colors: null,
    width: cellW * frameCount,
    height: cellH,
    cellW,
    cellH,
    frameCount,
    durationMs: Math.round((frameCount / FILMSTRIP_FPS) * 1000),
    sourceName: source.name,
  }
}
