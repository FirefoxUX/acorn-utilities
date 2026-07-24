// Distinct literal colors (fills + strokes) used anywhere in a built scene,
// for the Firefox color-role picker. Reads each node's static style — colors
// essentially never animate in practice, so the resting definition is enough.

import type { SceneModel, SceneNodeModel } from './build-scene'
import { rgbToHex } from './svg/emit'

function walk(node: SceneNodeModel, seen: Set<string>): void {
  if (node.style) {
    for (const color of [...node.style.fills, ...node.style.strokes]) {
      if (color) seen.add(rgbToHex(color.r, color.g, color.b))
    }
  }
  for (const child of node.children) walk(child, seen)
}

export function collectColors(scene: SceneModel): string[] {
  const seen = new Set<string>()
  walk(scene.root, seen)
  return [...seen]
}
