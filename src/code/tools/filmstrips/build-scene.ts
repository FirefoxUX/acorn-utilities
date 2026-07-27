// Walks the selected node's subtree once into a plain SceneModel of geometry,
// style, and Motion tracks. Geometry is read statically because Motion animates
// transform, trim, opacity, and color, not the underlying path points, so the
// per-frame renderer never touches the live document.

import { getAnimations } from './motion-types'
import { readTracks, type NodeTracks } from './interpolate'
import { parsePath, type Subpath } from './svg/path-data'
import {
  fromFigmaTransform,
  identity,
  invert,
  multiply,
  type Affine,
} from './svg/matrix'
import type { StrokeCap, StrokeJoin } from './svg/outline'

/** A resolved solid color (channels 0..1). */
export interface SolidColor {
  r: number
  g: number
  b: number
  a: number
}

/** One gradient stop; `color.a` carries the stop's alpha (see readPaint). */
export interface GradientStop {
  position: number
  color: SolidColor
}

/** A linear or radial gradient paint, resolved to a local-space transform. */
export interface GradientPaint {
  kind: 'gradient'
  gradientType: 'linear' | 'radial'
  stops: GradientStop[]
  /** Figma's gradientTransform, as an Affine (normalized space -> gradient space). */
  transform: Affine
  opacity: number
}

/** A resolved solid paint. */
export interface SolidPaint {
  kind: 'solid'
  color: SolidColor
}

/** A leaf fill or stroke the engine can render. Unsupported paints are null. */
export type Paint = SolidPaint | GradientPaint

export interface LeafGeometry {
  /** Filled area outline, from `fillGeometry`. */
  fillSubpaths: Subpath[]
  /** Stroke centerline: `vectorPaths` when present, else `fillGeometry`. */
  centerlineSubpaths: Subpath[]
}

export interface LeafStyle {
  /** Aligned to the node's fills; unsupported (angular/diamond) or hidden paints are null. */
  fills: (Paint | null)[]
  strokes: (Paint | null)[]
  strokeWidth: number
  strokeCap: StrokeCap
  strokeJoin: StrokeJoin
  strokeMiterLimit: number
  fillRule: 'nonzero' | 'evenodd'
}

export interface SceneNodeModel {
  type: string
  isLeaf: boolean
  restingMatrix: Affine
  width: number
  height: number
  baseOpacity: number
  visible: boolean
  /** True when this node masks its following siblings (Figma `isMask`). */
  isMask: boolean
  /** True when this container clips its content to its bounds (Figma `clipsContent`). */
  clipsContent: boolean
  children: SceneNodeModel[]
  geometry?: LeafGeometry
  style?: LeafStyle
  tracks?: NodeTracks
  hasTrim: boolean
}

export interface SceneModel {
  root: SceneNodeModel
  width: number
  height: number
}

const CONTAINER_TYPES = new Set([
  'FRAME',
  'GROUP',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE',
  'SECTION',
])

// Minimal structural shape of a raw Figma paint we read. Kept local so the
// engine's resolved Paint types (above) don't collide with the global Figma
// Paint union. `color.a` on a gradient stop is undocumented in the typings
// (ColorStop.color is RGB) but present at runtime — it carries the stop's alpha.
interface RawStop {
  position: number
  color: RGB & { a?: number }
}
interface RawPaint {
  type: string
  visible?: boolean
  opacity?: number
  color?: RGB
  gradientStops?: ReadonlyArray<RawStop>
  gradientTransform?: Transform
}

// Minimal shape of the geometry/style members we read, to avoid casting to the
// full node union for each optional property.
interface GeomNode {
  vectorPaths?: ReadonlyArray<{ windingRule: string; data: string }>
  fillGeometry?: ReadonlyArray<{ windingRule: string; data: string }>
  fills?: ReadonlyArray<RawPaint> | symbol
  strokes?: ReadonlyArray<RawPaint>
  strokeWeight?: number | symbol
  strokeCap?: string | symbol
  strokeJoin?: string | symbol
  strokeMiterLimit?: number
}

function readPaint(paint: RawPaint): Paint | null {
  if (paint.visible === false) return null
  if (paint.type === 'SOLID' && paint.color) {
    return {
      kind: 'solid',
      color: { ...paint.color, a: paint.opacity ?? 1 },
    }
  }
  if (paint.type === 'GRADIENT_LINEAR' || paint.type === 'GRADIENT_RADIAL') {
    if (!paint.gradientStops || !paint.gradientTransform) return null
    return {
      kind: 'gradient',
      gradientType: paint.type === 'GRADIENT_LINEAR' ? 'linear' : 'radial',
      stops: paint.gradientStops.map((s) => ({
        position: s.position,
        color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a ?? 1 },
      })),
      transform: fromFigmaTransform(paint.gradientTransform),
      opacity: paint.opacity ?? 1,
    }
  }
  // Angular/diamond gradients and image/video paints aren't supported yet.
  return null
}

function readPaints(
  paints: ReadonlyArray<RawPaint> | symbol | undefined,
): (Paint | null)[] {
  if (!paints || !Array.isArray(paints)) return []
  return paints.map(readPaint)
}

function parseGeometry(
  paths: ReadonlyArray<{ windingRule: string; data: string }> | undefined,
): { subpaths: Subpath[]; fillRule: 'nonzero' | 'evenodd' } {
  if (!paths || paths.length === 0) return { subpaths: [], fillRule: 'nonzero' }
  const subpaths: Subpath[] = []
  let evenodd = false
  for (const p of paths) {
    if (p.windingRule === 'EVENODD') evenodd = true
    subpaths.push(...parsePath(p.data))
  }
  return { subpaths, fillRule: evenodd ? 'evenodd' : 'nonzero' }
}

function mapCap(cap: string | symbol | undefined): StrokeCap {
  if (cap === 'ROUND') return 'round'
  if (cap === 'SQUARE') return 'square'
  return 'butt'
}

function mapJoin(join: string | symbol | undefined): StrokeJoin {
  if (join === 'ROUND') return 'round'
  if (join === 'BEVEL') return 'bevel'
  return 'miter'
}

function buildLeaf(node: SceneNode & GeomNode): {
  geometry: LeafGeometry
  style: LeafStyle
} {
  const fill = parseGeometry(node.fillGeometry)
  const centerline =
    node.vectorPaths && node.vectorPaths.length > 0
      ? parseGeometry(node.vectorPaths).subpaths
      : fill.subpaths

  const strokeWidth =
    typeof node.strokeWeight === 'number' ? node.strokeWeight : 1

  return {
    geometry: { fillSubpaths: fill.subpaths, centerlineSubpaths: centerline },
    style: {
      fills: readPaints(node.fills),
      strokes: readPaints(node.strokes),
      strokeWidth,
      strokeCap: mapCap(node.strokeCap),
      strokeJoin: mapJoin(node.strokeJoin),
      strokeMiterLimit: node.strokeMiterLimit ?? 4,
      fillRule: fill.fillRule,
    },
  }
}

// A node's resting transform relative to its parent, derived from absolute
// (page-space) transforms rather than `relativeTransform`. Figma reports a GROUP
// child's `relativeTransform` relative to the group's parent frame — not the
// group — so chaining group×child would double the group's offset. Deriving from
// absolutes (inverse(parentAbs) × nodeAbs) telescopes correctly for both frames
// and groups. Falls back to `relativeTransform` if the parent is non-invertible.
function restingRelativeToParent(node: SceneNode, parentAbs: Affine): Affine {
  const inv = invert(parentAbs)
  if (!inv) return fromFigmaTransform(node.relativeTransform)
  return multiply(inv, fromFigmaTransform(node.absoluteTransform))
}

function buildNode(node: SceneNode, parentAbs: Affine | null): SceneNodeModel {
  const anims = getAnimations(node)
  const tracks = anims ? readTracks(anims) : undefined
  const hasTrim = !!(tracks?.numeric.trimStart || tracks?.numeric.trimEnd)

  const base: SceneNodeModel = {
    type: node.type,
    isLeaf: false,
    // The root is normalized to identity; descendants are placed relative to it.
    restingMatrix: parentAbs
      ? restingRelativeToParent(node, parentAbs)
      : identity(),
    width: node.width,
    height: node.height,
    baseOpacity: 'opacity' in node ? node.opacity : 1,
    visible: node.visible !== false,
    isMask: 'isMask' in node && node.isMask === true,
    clipsContent: 'clipsContent' in node && node.clipsContent === true,
    children: [],
    tracks,
    hasTrim,
  }

  const nodeAbs = fromFigmaTransform(node.absoluteTransform)

  const isContainer =
    CONTAINER_TYPES.has(node.type) &&
    'children' in node &&
    node.type !== 'BOOLEAN_OPERATION'

  if (isContainer) {
    base.children = (node as SceneNode & ChildrenMixin).children.map((c) =>
      buildNode(c, nodeAbs),
    )
    return base
  }

  // Leaf: shapes and boolean operations render from their geometry. Text is
  // skipped in v1 (no geometry read), leaving nothing to draw.
  if (node.type !== 'TEXT' && 'fillGeometry' in node) {
    const { geometry, style } = buildLeaf(node as SceneNode & GeomNode)
    base.isLeaf = true
    base.geometry = geometry
    base.style = style
  }
  return base
}

/** Read the source subtree into a static SceneModel with the root normalized. */
export function buildScene(source: SceneNode): SceneModel {
  return {
    root: buildNode(source, null),
    width: source.width,
    height: source.height,
  }
}
