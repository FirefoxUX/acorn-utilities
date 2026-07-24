// Pure node classification utilities — no pipeline context, safe to unit-test in isolation.

const BLACK_THRESHOLD = 0.01

/**
 * Check if a paint is actually visible (not hidden, not fully transparent).
 */
function isVisiblePaint(paint: Paint): boolean {
  if (paint.visible === false) return false
  if (paint.type === 'SOLID' && (paint.opacity ?? 1) === 0) return false
  return true
}

/**
 * Check if a node is visible — has any visible fill OR visible stroke.
 */
export function isNodeVisible(node: SceneNode): boolean {
  // Check fills
  if ('fills' in node) {
    const fills = node.fills
    if (fills === figma.mixed) return true
    if (Array.isArray(fills) && fills.some(isVisiblePaint)) return true
  }

  // Check strokes
  if ('strokes' in node) {
    const strokes = node.strokes
    if (Array.isArray(strokes) && strokes.some(isVisiblePaint)) return true
  }

  return false
}

/**
 * Check if a solid paint is black.
 */
function isSolidBlack(paint: SolidPaint): boolean {
  const { r, g, b } = paint.color
  return r <= BLACK_THRESHOLD && g <= BLACK_THRESHOLD && b <= BLACK_THRESHOLD
}

/**
 * Determine if visible paints in a list are black. Returns null if no visible solid paints.
 */
function arePaintsBlack(
  paints: ReadonlyArray<Paint> | typeof figma.mixed,
): boolean | null {
  if (paints === figma.mixed) return null
  if (!Array.isArray(paints)) return null

  for (const paint of paints) {
    if (
      paint.type === 'SOLID' &&
      paint.visible !== false &&
      (paint.opacity ?? 1) > 0
    ) {
      return isSolidBlack(paint)
    }
  }
  return null
}

/**
 * Classify a node as black or non-black based on both fill and stroke.
 * Throws if the node has both a visible fill and visible stroke that disagree.
 */
export function isNodeBlack(node: SceneNode): boolean {
  const fillBlack =
    'fills' in node ? arePaintsBlack(node.fills as ReadonlyArray<Paint>) : null
  const strokeBlack =
    'strokes' in node
      ? arePaintsBlack(node.strokes as ReadonlyArray<Paint>)
      : null

  if (fillBlack !== null && strokeBlack !== null && fillBlack !== strokeBlack) {
    throw new Error(
      `Shape "${node.name}" has a ${fillBlack ? 'black' : 'non-black'} fill but a ${strokeBlack ? 'black' : 'non-black'} stroke. Cannot classify.`,
    )
  }

  // Return whichever is non-null, preferring fill
  if (fillBlack !== null) return fillBlack
  if (strokeBlack !== null) return strokeBlack

  // Fallback: treat as non-black
  return false
}

/**
 * Recursively flatten the node hierarchy so all shapes become
 * direct children of the target frame. Ungroups groups, nested frames,
 * and boolean operation nodes until only leaf shapes remain.
 */
export function flattenHierarchy(frame: FrameNode): void {
  let changed = true
  while (changed) {
    changed = false
    for (const child of [...frame.children]) {
      if (
        child.type === 'GROUP' ||
        child.type === 'BOOLEAN_OPERATION' ||
        (child.type === 'FRAME' && 'children' in child)
      ) {
        // For nested frames, clear their fills first so background doesn't
        // become a shape, then ungroup to promote children
        if (child.type === 'FRAME') {
          ;(child as FrameNode).fills = []
        }
        figma.ungroup(child)
        changed = true
      }
    }
  }
}

/**
 * Convert visible strokes on each direct child of `parent` into filled
 * vector outlines. After this runs, children carry their stroke geometry
 * as fills, so subsequent boolean operations (union, subtract) treat all
 * input shapes uniformly.
 *
 * Without this, `figma.union()` on a mix of fill-only and stroke-only
 * shapes can drop the fill geometry of some inputs — leaving only the
 * stroke shape's outline in the flattened result.
 */
export function outlineStrokesInside(parent: FrameNode | GroupNode): void {
  for (const child of [...parent.children]) {
    if (!('strokes' in child)) continue
    const strokes = child.strokes
    if (!Array.isArray(strokes) || !strokes.some(isVisiblePaint)) continue
    if (
      !('outlineStroke' in child) ||
      typeof (child as { outlineStroke?: unknown }).outlineStroke !== 'function'
    )
      continue

    const outlined = (
      child as
        | VectorNode
        | RectangleNode
        | EllipseNode
        | StarNode
        | PolygonNode
        | LineNode
    ).outlineStroke()
    if (!outlined) continue

    // Defensive: outlineStroke() is supposed to insert the new vector as a
    // sibling of the original and copy strokes onto its fills, but neither
    // behavior is reliable in practice. Pin the outlined vector to `parent`
    // and copy the stroke paints onto its fills ourselves so it definitely
    // participates in the subsequent union/flatten.
    if (outlined.parent !== parent) {
      parent.appendChild(outlined)
    }
    const visibleStrokeFills = strokes.filter(isVisiblePaint)
    if (visibleStrokeFills.length > 0) {
      outlined.fills = visibleStrokeFills
    }
    outlined.strokes = []

    const hasVisibleFills =
      'fills' in child &&
      Array.isArray(child.fills) &&
      child.fills.some(isVisiblePaint)

    if (hasVisibleFills) {
      // Keep the original to preserve its fill; the outlined sibling now
      // carries the stroke geometry as a fill.
      child.strokes = []
    } else {
      child.remove()
    }
  }
}

/**
 * Recursively flatten nested groups/frames/boolean ops *inside* the given
 * group so all leaf shapes become direct children of it, but leave the
 * group itself intact. Counterpart to `flattenHierarchy` for the duotone
 * pipeline, which needs the channel groups (`context-fill` /
 * `context-stroke`) to survive as named containers.
 */
export function flattenInside(group: GroupNode): void {
  let changed = true
  while (changed) {
    changed = false
    for (const child of [...group.children]) {
      if (
        child.type === 'GROUP' ||
        child.type === 'BOOLEAN_OPERATION' ||
        (child.type === 'FRAME' && 'children' in child)
      ) {
        if (child.type === 'FRAME') {
          ;(child as FrameNode).fills = []
        }
        figma.ungroup(child)
        changed = true
      }
    }
  }
}
