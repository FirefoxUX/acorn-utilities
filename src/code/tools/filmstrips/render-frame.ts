// Renders one filmstrip frame to SVG markup from a SceneModel at time t. It
// walks the tree composing world transforms and cumulative opacity, trims
// stroked centerlines, and emits each leaf's fills and strokes. Stroke output
// is either an SVG stroke or a filled outline; paint is either literal colors
// or a per-color Firefox context-fill/context-stroke/literal mapping.

import { buildPose, type Pose } from './interpolate'
import {
  composePose,
  multiply,
  toSvgMatrix,
  identity,
  type Affine,
} from './svg/matrix'
import { trimSubpaths } from './svg/trim'
import { outlineStroke } from './svg/outline'
import { subpathsToData, polygonsToData } from './svg/path-data'
import { pathEl, groupEl, rgbToHex } from './svg/emit'
import type { SceneModel, SceneNodeModel, SolidColor } from './build-scene'
import type { ColorMapping } from '@tools/filmstrips/types'

export interface RenderOptions {
  strokeOutput: 'stroke' | 'outline'
  /** Null renders literal colors everywhere (the standard export). */
  colorMapping: ColorMapping | null
}

const EMPTY_POSE: Pose = { fills: [], strokes: [] }

/**
 * Resolve a color to its paint string. Unmapped colors default to
 * context-fill (Firefox's own default/primary role) rather than literal, so
 * a single-color icon needs no explicit mapping at all.
 */
function paintFor(color: SolidColor, mapping: ColorMapping | null): string {
  const hex = rgbToHex(color.r, color.g, color.b)
  if (!mapping) return hex
  const role = mapping[hex] ?? 'context-fill'
  return role === 'literal' ? hex : role
}

function firstColor(
  colors: (SolidColor | null)[],
  overrides: { index: number; color: SolidColor }[],
): SolidColor | null {
  for (let i = 0; i < colors.length; i++) {
    const override = overrides.find((o) => o.index === i)
    if (override) return override.color
    if (colors[i]) return colors[i]
  }
  return null
}

function renderLeaf(
  node: SceneNodeModel,
  pose: Pose,
  options: RenderOptions,
): string {
  const { geometry, style } = node
  if (!geometry || !style) return ''
  const parts: string[] = []

  // Fill.
  const fillColor = firstColor(style.fills, pose.fills)
  if (fillColor && geometry.fillSubpaths.length > 0) {
    parts.push(
      pathEl({
        d: subpathsToData(geometry.fillSubpaths),
        fill: paintFor(fillColor, options.colorMapping),
        fillOpacity: fillColor.a,
        fillRule: style.fillRule,
      }),
    )
  }

  // Stroke.
  const strokeColor = firstColor(style.strokes, pose.strokes)
  if (
    strokeColor &&
    style.strokeWidth > 0 &&
    geometry.centerlineSubpaths.length > 0
  ) {
    const animatesTrim =
      pose.trimStart !== undefined ||
      pose.trimEnd !== undefined ||
      pose.trimOffset !== undefined
    const centerline = animatesTrim
      ? trimSubpaths(
          geometry.centerlineSubpaths,
          pose.trimStart ?? 0,
          pose.trimEnd ?? 1,
          pose.trimOffset ?? 0,
          style.strokeWidth,
        )
      : geometry.centerlineSubpaths

    if (centerline.length > 0) {
      const paint = paintFor(strokeColor, options.colorMapping)

      if (options.strokeOutput === 'outline') {
        const outlined = outlineStroke(centerline, {
          width: style.strokeWidth,
          cap: style.strokeCap,
          join: style.strokeJoin,
          miterLimit: style.strokeMiterLimit,
        })
        if (outlined.length > 0) {
          parts.push(
            pathEl({
              d: polygonsToData(outlined),
              fill: paint,
              fillOpacity: strokeColor.a,
            }),
          )
        }
      } else {
        parts.push(
          pathEl({
            d: subpathsToData(centerline),
            fill: 'none',
            stroke: paint,
            strokeOpacity: strokeColor.a,
            strokeWidth: style.strokeWidth,
            strokeLinecap: style.strokeCap,
            strokeLinejoin: style.strokeJoin,
          }),
        )
      }
    }
  }

  return parts.join('')
}

function walk(
  node: SceneNodeModel,
  parentWorld: Affine,
  parentOpacity: number,
  t: number,
  options: RenderOptions,
): string {
  if (!node.visible) return ''
  const pose = node.tracks ? buildPose(node.tracks, t) : EMPTY_POSE
  const local = node.tracks
    ? composePose(node.restingMatrix, pose, node.width, node.height)
    : node.restingMatrix
  const world = multiply(parentWorld, local)
  const opacity = parentOpacity * node.baseOpacity * (pose.opacity ?? 1)

  let markup: string
  if (node.isLeaf) {
    markup = renderLeaf(node, pose, options)
  } else {
    markup = node.children
      .map((c) => walk(c, world, opacity, t, options))
      .join('')
  }
  if (!markup) return ''

  // Leaves carry the composed transform; containers only pass it down.
  return node.isLeaf ? groupEl(toSvgMatrix(world), opacity, markup) : markup
}

/** Inner SVG markup (no wrapping <svg>) for the scene at time t seconds. */
export function renderFrame(
  scene: SceneModel,
  t: number,
  options: RenderOptions,
): string {
  return walk(scene.root, identity(), 1, t, options)
}
