// Cheap, cloning-free inspection of a node's Motion animation. Figma Motion
// keyframes live on the animated layers themselves (often nested descendants),
// while the timeline/duration is associated with the whole subtree — so we
// recurse to detect animation and aggregate caveats.

import {
  getAnimations,
  getTimelines,
  type KeyframeBinding,
} from './motion-types'
import { readTracks } from './interpolate'
import type { SelectionMotionInfo } from '@tools/filmstrips/types'

function bindingDurationSec(b: KeyframeBinding): number {
  let max = b.timelineDuration ?? 0
  for (const track of b.tracks) {
    for (const kf of track.keyframes) {
      if (kf.timelinePosition > max) max = kf.timelinePosition
    }
  }
  return max
}

/** Every node in the subtree (including `node`) that carries Motion keyframes. */
export function collectAnimated(node: SceneNode): SceneNode[] {
  const list: SceneNode[] = []
  if (getAnimations(node)) list.push(node)
  if ('findAll' in node) {
    list.push(
      ...(node as SceneNode & ChildrenMixin).findAll(
        (n) => getAnimations(n) !== null,
      ),
    )
  }
  return list
}

/** Total animation duration in seconds (timeline first, else longest binding). */
export function subtreeDurationSec(
  node: SceneNode,
  animated: SceneNode[],
): number {
  const timelines = getTimelines(node)
  const fromTimeline = timelines.length
    ? Math.max(...timelines.map((t) => t.duration))
    : 0
  if (fromTimeline > 0) return fromTimeline

  let max = 0
  for (const n of animated) {
    const anims = getAnimations(n)
    if (!anims) continue
    for (const [key, value] of Object.entries(anims)) {
      if (!value) continue
      if (key === 'fills' || key === 'strokes' || key === 'effects') {
        for (const b of Object.values(
          value as Record<number, KeyframeBinding>,
        )) {
          if (b) max = Math.max(max, bindingDurationSec(b))
        }
      } else {
        max = Math.max(max, bindingDurationSec(value as KeyframeBinding))
      }
    }
  }
  return max
}

/** Summarize the Motion animation across a node's subtree for the idle view. */
export function inspectNode(node: SceneNode): SelectionMotionInfo {
  const animated = collectAnimated(node)
  if (animated.length === 0) {
    return {
      name: node.name,
      hasAnimation: false,
      timelineDurationMs: 0,
      nestedKeyframesPresent: false,
      unsupportedNotes: [],
    }
  }

  const notes = new Set<string>()
  for (const n of animated) {
    const anims = getAnimations(n)
    if (!anims) continue
    for (const note of readTracks(anims).unsupportedNotes) notes.add(note)
  }

  const nested = animated.some((n) => n !== node)
  const durationSec = subtreeDurationSec(node, animated)
  return {
    name: node.name,
    hasAnimation: true,
    timelineDurationMs: Math.round(durationSec * 1000),
    nestedKeyframesPresent: nested,
    unsupportedNotes: [...notes],
  }
}
