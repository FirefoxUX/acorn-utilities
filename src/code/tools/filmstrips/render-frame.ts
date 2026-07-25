// Renders one filmstrip frame to an SVG node tree from a SceneModel at time t. It
// walks the tree composing world transforms and cumulative opacity, trims
// stroked centerlines, and emits each leaf's fills and strokes. Stroke output
// is either an SVG stroke or a filled outline; paint is either a literal color,
// a per-color Firefox context-fill/context-stroke/literal mapping, or a
// gradient paint server. A child marked as a mask clips its following siblings
// (a <clipPath> for a solid-opaque mask, else an alpha <mask>).
//
// Per-frame gradient and clip/mask definitions are collected into `ctx.defs`
// and placed in the cell by render-filmstrip. Their ids are frame-prefixed
// because SVG ids are document-global (first match wins), so reusing a bare id
// across cells would resolve to the wrong cell.

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
import {
  pathEl,
  groupNodes,
  stopEl,
  linearGradientEl,
  radialGradientEl,
  clipPathEl,
  maskEl,
  maskWrapperEl,
} from './svg/emit'
import { rgbToHex } from './svg/round'
import { el, type SvgChild, type SvgElement } from './svg/node'
import { linearHandles, radialTransform } from './svg/gradient'
import type {
  SceneModel,
  SceneNodeModel,
  SolidColor,
  Paint,
  GradientPaint,
} from './build-scene'
import type { ColorMapping } from '@tools/filmstrips/types'

export interface RenderOptions {
  strokeOutput: 'stroke' | 'outline'
  /** Null renders literal colors everywhere (the standard export). */
  colorMapping: ColorMapping | null
}

/** Inner SVG nodes plus the per-frame defs (gradients, clip/mask) they referenced. */
export interface RenderedFrame {
  nodes: SvgChild[]
  defs: SvgElement[]
}

// Mutable per-frame state threaded through the walk: the frame index and a
// running counter give every def a document-unique id, and defs accumulate here.
interface RenderContext {
  frameIndex: number
  options: RenderOptions
  cellW: number
  cellH: number
  defs: SvgElement[]
  seq: number
}

const EMPTY_POSE: Pose = { fills: [], strokes: [] }

/**
 * Resolve a solid color to its paint string. Unmapped colors default to
 * context-fill (Firefox's own default/primary role) rather than literal, so
 * a single-color icon needs no explicit mapping at all.
 */
function solidPaintString(
  color: SolidColor,
  mapping: ColorMapping | null,
): string {
  const hex = rgbToHex(color.r, color.g, color.b)
  if (!mapping) return hex
  const role = mapping[hex] ?? 'context-fill'
  return role === 'literal' ? hex : role
}

// Emit a gradient def into ctx and return its id, or null if the paint's
// transform is singular (a collapsed shape mid-animation).
function emitGradient(
  paint: GradientPaint,
  w: number,
  h: number,
  ctx: RenderContext,
): string | null {
  const stops = paint.stops.map((s) =>
    stopEl(
      s.position,
      rgbToHex(s.color.r, s.color.g, s.color.b),
      s.color.a * paint.opacity,
    ),
  )

  const id = `f${ctx.frameIndex}_${ctx.seq}`
  if (paint.gradientType === 'linear') {
    const hnd = linearHandles(paint.transform, w, h)
    if (!hnd) return null
    ctx.defs.push(linearGradientEl(id, hnd.x1, hnd.y1, hnd.x2, hnd.y2, stops))
  } else {
    const m = radialTransform(paint.transform, w, h)
    if (!m) return null
    ctx.defs.push(radialGradientEl(id, toSvgMatrix(m), stops))
  }
  ctx.seq++
  return id
}

// A paint resolved to an SVG paint value + the opacity to apply. Gradients carry
// their alpha in the stops, so their opacity is always 1 (nothing extra to emit).
function resolvePaint(
  paint: Paint,
  node: SceneNodeModel,
  ctx: RenderContext,
): { value: string; opacity: number } | null {
  if (paint.kind === 'solid') {
    return {
      value: solidPaintString(paint.color, ctx.options.colorMapping),
      opacity: paint.color.a,
    }
  }
  const id = emitGradient(paint, node.width, node.height, ctx)
  return id ? { value: `url(#${id})`, opacity: 1 } : null
}

// First renderable paint, honoring animated color overrides. An override is a
// flat color, so it applies only to a solid slot; a gradient slot keeps its
// gradient (a flat color can't represent an animated gradient).
function firstPaint(
  paints: (Paint | null)[],
  overrides: { index: number; color: SolidColor }[],
): Paint | null {
  for (let i = 0; i < paints.length; i++) {
    const base = paints[i]
    if (base?.kind === 'gradient') return base
    const override = overrides.find((o) => o.index === i)
    if (override) return { kind: 'solid', color: override.color }
    if (base) return base
  }
  return null
}

function renderLeaf(
  node: SceneNodeModel,
  pose: Pose,
  ctx: RenderContext,
): SvgChild[] {
  const { geometry, style } = node
  if (!geometry || !style) return []
  const parts: SvgChild[] = []

  // Fill.
  const fillPaint = firstPaint(style.fills, pose.fills)
  if (fillPaint && geometry.fillSubpaths.length > 0) {
    const resolved = resolvePaint(fillPaint, node, ctx)
    if (resolved) {
      parts.push(
        pathEl({
          d: subpathsToData(geometry.fillSubpaths),
          fill: resolved.value,
          fillOpacity: resolved.opacity,
          fillRule: style.fillRule,
        }),
      )
    }
  }

  // Stroke.
  const strokePaint = firstPaint(style.strokes, pose.strokes)
  if (
    strokePaint &&
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
      const resolved = resolvePaint(strokePaint, node, ctx)
      if (resolved && ctx.options.strokeOutput === 'outline') {
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
              fill: resolved.value,
              fillOpacity: resolved.opacity,
            }),
          )
        }
      } else if (resolved) {
        parts.push(
          pathEl({
            d: subpathsToData(centerline),
            fill: 'none',
            stroke: resolved.value,
            strokeOpacity: resolved.opacity,
            strokeWidth: style.strokeWidth,
            strokeLinecap: style.strokeCap,
            strokeLinejoin: style.strokeJoin,
          }),
        )
      }
    }
  }

  return parts
}

// Compose a node's world transform at time t (matches walk's own composition).
function worldOf(node: SceneNodeModel, parentWorld: Affine, t: number): Affine {
  const pose = node.tracks ? buildPose(node.tracks, t) : EMPTY_POSE
  const local = node.tracks
    ? composePose(node.restingMatrix, pose, node.width, node.height)
    : node.restingMatrix
  return multiply(parentWorld, local)
}

// A mask that is a single leaf with a fully opaque solid fill and no opacity
// animation clips exactly like a geometric clip path — lighter than an alpha
// <mask>. Anything else (soft/gradient fill, a group, animated opacity) needs a
// real alpha mask.
function isSolidOpaqueMask(node: SceneNodeModel): boolean {
  if (!node.isLeaf || node.baseOpacity < 1 || node.tracks?.numeric.opacity) {
    return false
  }
  const fills = node.style?.fills ?? []
  return fills.some((p) => p?.kind === 'solid' && p.color.a >= 1)
}

// Build the clip/mask wrapper for a masked run. `inner` is the already-rendered
// masked siblings (each carrying its own world transform); the wrapper itself is
// transform-free, and the mask geometry is baked in the same frame space.
function buildMaskWrapper(
  maskNode: SceneNodeModel,
  inner: SvgChild[],
  parentWorld: Affine,
  t: number,
  ctx: RenderContext,
): SvgElement {
  const world = worldOf(maskNode, parentWorld, t)
  const id = `f${ctx.frameIndex}_${ctx.seq++}`

  if (isSolidOpaqueMask(maskNode) && maskNode.geometry) {
    // Bare geometry: a <clipPath> can't hold a <g>, so the world transform rides
    // on the path itself (transform before d, no paint).
    const clip = el('path', {
      transform: toSvgMatrix(world),
      d: subpathsToData(maskNode.geometry.fillSubpaths),
    })
    ctx.defs.push(clipPathEl(id, [clip]))
    return maskWrapperEl({ 'clip-path': `url(#${id})` }, inner)
  }

  // Soft mask: render the mask subtree normally (its fills' alpha is meaningful)
  // at full opacity — the container's display opacity already rides on the
  // masked content, not the mask.
  const content = walk(maskNode, parentWorld, 1, t, ctx)
  ctx.defs.push(maskEl(id, ctx.cellW, ctx.cellH, content))
  return maskWrapperEl({ mask: `url(#${id})` }, inner)
}

// Render a container's children, applying Figma mask semantics: a child marked
// as a mask clips the siblings after it up to the next mask.
function walkChildren(
  children: SceneNodeModel[],
  parentWorld: Affine,
  parentOpacity: number,
  t: number,
  ctx: RenderContext,
): SvgChild[] {
  const out: SvgChild[] = []
  let i = 0
  while (i < children.length) {
    const child = children[i]
    if (!child.isMask) {
      out.push(...walk(child, parentWorld, parentOpacity, t, ctx))
      i++
      continue
    }
    // Gather the run this mask applies to: following siblings up to the next mask.
    let j = i + 1
    const masked: SceneNodeModel[] = []
    while (j < children.length && !children[j].isMask) {
      masked.push(children[j])
      j++
    }
    const inner: SvgChild[] = []
    for (const m of masked) {
      inner.push(...walk(m, parentWorld, parentOpacity, t, ctx))
    }
    // Empty run: the mask clips nothing, so emit nothing and no orphan def.
    if (inner.length > 0) {
      out.push(buildMaskWrapper(child, inner, parentWorld, t, ctx))
    }
    i = j
  }
  return out
}

function walk(
  node: SceneNodeModel,
  parentWorld: Affine,
  parentOpacity: number,
  t: number,
  ctx: RenderContext,
): SvgChild[] {
  if (!node.visible) return []
  const pose = node.tracks ? buildPose(node.tracks, t) : EMPTY_POSE
  const local = node.tracks
    ? composePose(node.restingMatrix, pose, node.width, node.height)
    : node.restingMatrix
  const world = multiply(parentWorld, local)
  const opacity = parentOpacity * node.baseOpacity * (pose.opacity ?? 1)

  const markup: SvgChild[] = node.isLeaf
    ? renderLeaf(node, pose, ctx)
    : walkChildren(node.children, world, opacity, t, ctx)
  if (markup.length === 0) return []

  // Leaves carry the composed transform; containers only pass it down.
  return node.isLeaf ? groupNodes(toSvgMatrix(world), opacity, markup) : markup
}

/** Inner SVG nodes + defs for the scene at time t seconds (frame `frameIndex`). */
export function renderFrame(
  scene: SceneModel,
  t: number,
  frameIndex: number,
  options: RenderOptions,
): RenderedFrame {
  const ctx: RenderContext = {
    frameIndex,
    options,
    cellW: scene.width,
    cellH: scene.height,
    defs: [],
    seq: 0,
  }
  const nodes = walk(scene.root, identity(), 1, t, ctx)
  return { nodes, defs: ctx.defs }
}
