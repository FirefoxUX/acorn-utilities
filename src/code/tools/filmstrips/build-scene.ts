// Walks the selected node's subtree once into a plain SceneModel of geometry,
// style, and Motion tracks. Geometry is read statically because Motion animates
// transform, trim, opacity, and color, not the underlying path points, so the
// per-frame renderer never touches the live document.

import { getAnimations } from './motion-types'
import { readTracks, type NodeTracks } from './interpolate'
import { parsePath, type Subpath } from './svg/path-data'
import { fromFigmaTransform, identity, type Affine } from './svg/matrix'
import type { StrokeCap, StrokeJoin } from './svg/outline'

/** A resolved solid color (channels 0..1). */
export interface SolidColor {
  r: number
  g: number
  b: number
  a: number
}

export interface LeafGeometry {
  /** Filled area outline, from `fillGeometry`. */
  fillSubpaths: Subpath[]
  /** Stroke centerline: `vectorPaths` when present, else `fillGeometry`. */
  centerlineSubpaths: Subpath[]
}

export interface LeafStyle {
  /** Aligned to the node's fills; non-solid or hidden paints are null. */
  fills: (SolidColor | null)[]
  strokes: (SolidColor | null)[]
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

// Minimal shape of the geometry/style members we read, to avoid casting to the
// full node union for each optional property.
interface GeomNode {
  vectorPaths?: ReadonlyArray<{ windingRule: string; data: string }>
  fillGeometry?: ReadonlyArray<{ windingRule: string; data: string }>
  fills?: ReadonlyArray<Paint> | symbol
  strokes?: ReadonlyArray<Paint>
  strokeWeight?: number | symbol
  strokeCap?: string | symbol
  strokeJoin?: string | symbol
  strokeMiterLimit?: number
}

function readColor(paint: Paint): SolidColor | null {
  if (paint.type === 'SOLID' && paint.visible !== false) {
    return {
      r: paint.color.r,
      g: paint.color.g,
      b: paint.color.b,
      a: paint.opacity ?? 1,
    }
  }
  return null
}

function readPaints(
  paints: ReadonlyArray<Paint> | symbol | undefined,
): (SolidColor | null)[] {
  if (!paints || !Array.isArray(paints)) return []
  return paints.map(readColor)
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

function buildNode(node: SceneNode, isRoot: boolean): SceneNodeModel {
  const anims = getAnimations(node)
  const tracks = anims ? readTracks(anims) : undefined
  const hasTrim = !!(tracks?.numeric.trimStart || tracks?.numeric.trimEnd)

  const base: SceneNodeModel = {
    type: node.type,
    isLeaf: false,
    restingMatrix: isRoot
      ? identity()
      : fromFigmaTransform(node.relativeTransform),
    width: node.width,
    height: node.height,
    baseOpacity: 'opacity' in node ? node.opacity : 1,
    visible: node.visible !== false,
    children: [],
    tracks,
    hasTrim,
  }

  const isContainer =
    CONTAINER_TYPES.has(node.type) &&
    'children' in node &&
    node.type !== 'BOOLEAN_OPERATION'

  if (isContainer) {
    base.children = (node as SceneNode & ChildrenMixin).children.map((c) =>
      buildNode(c, false),
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
    root: buildNode(source, true),
    width: source.width,
    height: source.height,
  }
}
