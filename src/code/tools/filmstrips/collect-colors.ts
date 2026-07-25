// Distinct literal colors (fills + strokes) used anywhere in a built scene,
// for the Firefox color-role picker. Reads each node's static style. colors
// essentially never animate in practice, so the resting definition is enough.

import type { SceneModel, SceneNodeModel } from './build-scene'
import { rgbToHex } from './svg/emit'

function walk(node: SceneNodeModel, seen: Set<string>): void {
  // A mask node's fill is consumed as a clip, never painted, so it must not
  // surface as a Firefox color role. Gradients have no single role either.
  if (node.style && !node.isMask) {
    for (const paint of [...node.style.fills, ...node.style.strokes]) {
      if (paint?.kind === 'solid') {
        const { r, g, b } = paint.color
        seen.add(rgbToHex(r, g, b))
      }
    }
  }
  for (const child of node.children) walk(child, seen)
}

export function collectColors(scene: SceneModel): string[] {
  const seen = new Set<string>()
  walk(scene.root, seen)
  return [...seen]
}
