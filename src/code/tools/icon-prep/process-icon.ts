import { ICON_LIBRARY } from './icon-library'
import {
  isDuotoneName,
  parseFrameName,
  serializeFrameName,
  toKebabCase,
  stripSize,
} from './frame-name'
import type { PipelineStepId, PipelineVariant } from '@tools/icon-prep/pipeline'
import {
  flattenHierarchy,
  flattenInside,
  isNodeBlack,
  isNodeVisible,
  outlineStrokesInside,
} from '@code/shared/node-utils'

const GRID_COLUMNS = 8
const GRID_SPACING = 16
const DUPLICATE_OFFSET = 200

const DUOTONE_FILL_NAME = 'context-fill'
const DUOTONE_STROKE_NAME = 'context-stroke'

type ProgressCallback = (index: number, total: number, name: string) => void

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

type PipelineContext = {
  frame: FrameNode
  autoAssignCategory: boolean
  blackShapes: SceneNode[]
  nonBlackShapes: SceneNode[]
  resultNode: SceneNode | null
  fillChannel: GroupNode | null
  strokeChannel: GroupNode | null
  unmatched: string | null
}

type PipelineStep = {
  id: PipelineStepId
  run: (ctx: PipelineContext) => void
}

// Each step receives the shared context and mutates it in place.
// Steps run in order; a thrown error short-circuits the pipeline and is
// captured as a per-icon failure (not a global one).
const standardSteps: PipelineStep[] = [
  {
    id: 'flatten',
    run(ctx) {
      flattenHierarchy(ctx.frame)
    },
  },
  {
    id: 'clean',
    run(ctx) {
      ctx.frame.fills = []
      ctx.frame.strokes = []
      for (const child of [...ctx.frame.children]) {
        if (!isNodeVisible(child)) {
          child.remove()
        }
      }
      // Normalize strokes to fills before classify/combine. Mixing fill-only
      // and stroke-only shapes in a single figma.union() can drop the fills.
      outlineStrokesInside(ctx.frame)
    },
  },
  {
    id: 'classify',
    run(ctx) {
      for (const child of [...ctx.frame.children]) {
        if (isNodeBlack(child)) {
          ctx.blackShapes.push(child)
        } else {
          ctx.nonBlackShapes.push(child)
        }
      }
    },
  },
  {
    id: 'combine',
    run(ctx) {
      if (ctx.blackShapes.length === 0 && ctx.nonBlackShapes.length === 0) {
        return
      }

      // Mirror the manual UI workflow: union the shapes, then flatten the
      // union into a single vector.
      const unionAndFlatten = (shapes: SceneNode[]): VectorNode => {
        const union = figma.union(shapes, ctx.frame)
        return figma.flatten([union], ctx.frame)
      }

      if (ctx.nonBlackShapes.length === 0) {
        ctx.resultNode = unionAndFlatten(ctx.blackShapes)
      } else if (ctx.blackShapes.length === 0) {
        ctx.resultNode = unionAndFlatten(ctx.nonBlackShapes)
      } else {
        const blackUnion = figma.union(ctx.blackShapes, ctx.frame)
        const nonBlackUnion = figma.union(ctx.nonBlackShapes, ctx.frame)
        const subtracted = figma.subtract(
          [blackUnion, nonBlackUnion],
          ctx.frame,
        )
        ctx.resultNode = figma.flatten([subtracted], ctx.frame)
      }
    },
  },
  {
    id: 'finalize',
    run(ctx) {
      if (ctx.resultNode && 'fills' in ctx.resultNode) {
        ctx.resultNode.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
      }
      if (ctx.resultNode) {
        ctx.resultNode.name = 'Shape'
      }
    },
  },
]

// Duotone variant: the frame holds two named groups (`context-fill`,
// `context-stroke`). Each one is unioned/flattened independently into a
// single shape that keeps the channel name, so Figma's SVG export writes
// `id="context-fill"` / `id="context-stroke"` on the two paths. The
// acorn-icons CI then rewrites those ids into per-element `fill` attrs.
const duotoneSteps: PipelineStep[] = [
  {
    id: 'validate-duotone',
    run(ctx) {
      ctx.frame.fills = []
      ctx.frame.strokes = []

      let fillGroup: GroupNode | null = null
      let strokeGroup: GroupNode | null = null
      const stray: string[] = []

      for (const child of ctx.frame.children) {
        if (!isNodeVisible(child)) continue
        if (child.type === 'GROUP' && child.name === DUOTONE_FILL_NAME) {
          if (fillGroup) {
            throw new Error(
              `Duotone frame has more than one "${DUOTONE_FILL_NAME}" group.`,
            )
          }
          fillGroup = child
        } else if (
          child.type === 'GROUP' &&
          child.name === DUOTONE_STROKE_NAME
        ) {
          if (strokeGroup) {
            throw new Error(
              `Duotone frame has more than one "${DUOTONE_STROKE_NAME}" group.`,
            )
          }
          strokeGroup = child
        } else {
          stray.push(child.name || child.type.toLowerCase())
        }
      }

      if (stray.length > 0) {
        throw new Error(
          `Duotone frame has unexpected top-level shape "${stray[0]}" — duotone frames may only contain the "${DUOTONE_FILL_NAME}" and "${DUOTONE_STROKE_NAME}" groups.`,
        )
      }
      if (!fillGroup) {
        throw new Error(
          `Duotone frame is missing the "${DUOTONE_FILL_NAME}" group.`,
        )
      }
      if (!strokeGroup) {
        throw new Error(
          `Duotone frame is missing the "${DUOTONE_STROKE_NAME}" group.`,
        )
      }

      ctx.fillChannel = fillGroup
      ctx.strokeChannel = strokeGroup
    },
  },
  {
    id: 'flatten-channels',
    run(ctx) {
      for (const group of [ctx.fillChannel, ctx.strokeChannel]) {
        if (!group) continue
        flattenInside(group)
        for (const child of [...group.children]) {
          if (!isNodeVisible(child)) {
            child.remove()
          }
        }
        outlineStrokesInside(group)
        if (group.children.length === 0) {
          throw new Error(`Duotone group "${group.name}" is empty.`)
        }
      }
    },
  },
  {
    id: 'combine-channels',
    run(ctx) {
      for (const channelKey of ['fillChannel', 'strokeChannel'] as const) {
        const group = ctx[channelKey]
        if (!group) continue
        const channelName = group.name
        // Mirror the manual UI workflow: union then flatten.
        const shapes = [...group.children]
        const union = figma.union(shapes, ctx.frame)
        const flat = figma.flatten([union], ctx.frame)
        flat.name = channelName
        // Discard the now-empty wrapper group.
        if (group.parent) group.remove()
        if (channelKey === 'fillChannel') {
          ctx.fillChannel = null
        } else {
          ctx.strokeChannel = null
        }
        // Keep a reference to the resulting node via resultNode for
        // potential future steps; finalize uses frame.children directly.
        ctx.resultNode = flat
      }
    },
  },
  {
    id: 'finalize-channels',
    run(ctx) {
      for (const child of ctx.frame.children) {
        if ('fills' in child) {
          child.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
        }
      }
    },
  },
]

const sharedTailSteps: PipelineStep[] = [
  {
    id: 'rename',
    run(ctx) {
      const parsed = parseFrameName(ctx.frame.name)
      if (parsed) {
        ctx.frame.name = serializeFrameName({
          category: toKebabCase(parsed.category),
          iconName: toKebabCase(parsed.iconName),
        })
      } else {
        ctx.frame.name = toKebabCase(ctx.frame.name)
      }
    },
  },
  {
    id: 'categorize',
    run(ctx) {
      if (!ctx.autoAssignCategory) return

      const parsedName = parseFrameName(ctx.frame.name)
      if (parsedName) {
        const baseName = stripSize(parsedName.iconName).replace(/-duotone$/, '')
        const category = ICON_LIBRARY[baseName]
        if (category) {
          ctx.frame.name = serializeFrameName({
            ...parsedName,
            category,
          })
          return
        }
        ctx.frame.fills = [
          { type: 'SOLID', color: { r: 0.835, g: 0.471, b: 0 } },
        ]
        ctx.unmatched = ctx.frame.name
      } else {
        ctx.frame.fills = [
          { type: 'SOLID', color: { r: 0.835, g: 0.471, b: 0 } },
        ]
        ctx.unmatched = ctx.frame.name
      }
    },
  },
]

type ProcessFrameResult = {
  unmatched: string | null
  pipeline: PipelineVariant
  failedStep?: PipelineStepId
  error?: string
}

/**
 * Pick the pipeline branch for a frame based on its name. Defaults to
 * standard for any frame whose icon-name portion does not match
 * `-duotone-<size>`.
 */
function pipelineFor(frameName: string): {
  variant: PipelineVariant
  steps: PipelineStep[]
} {
  const parsed = parseFrameName(frameName)
  const iconName = parsed ? parsed.iconName : frameName
  if (isDuotoneName(toKebabCase(iconName))) {
    return { variant: 'duotone', steps: [...duotoneSteps, ...sharedTailSteps] }
  }
  return { variant: 'standard', steps: [...standardSteps, ...sharedTailSteps] }
}

/**
 * Run the pipeline on a single already-cloned frame.
 * Catches any step error and returns it as a structured result — never throws.
 */
function processFrame(
  clonedFrame: FrameNode,
  autoAssignCategory: boolean,
): ProcessFrameResult {
  const { variant, steps } = pipelineFor(clonedFrame.name)

  const ctx: PipelineContext = {
    frame: clonedFrame,
    autoAssignCategory,
    blackShapes: [],
    nonBlackShapes: [],
    resultNode: null,
    fillChannel: null,
    strokeChannel: null,
    unmatched: null,
  }

  for (const step of steps) {
    try {
      step.run(ctx)
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'An unknown error occurred'
      return {
        unmatched: null,
        pipeline: variant,
        failedStep: step.id,
        error: message,
      }
    }
  }

  return { unmatched: ctx.unmatched, pipeline: variant }
}

/**
 * Clone each selected frame, process the clone through the pipeline, and
 * arrange all clones in a grid to the right of the original selection.
 * Yields to Figma every 5 icons so the UI stays responsive during long runs.
 */
export async function processSelectedIcons(
  selection: readonly SceneNode[],
  autoAssignCategory: boolean,
  onProgress: ProgressCallback,
): Promise<{
  frames: FrameNode[]
  unmatchedIcons: string[]
  iconErrors: Array<{
    iconName: string
    error: string
    failedStep: string
    pipeline: PipelineVariant
  }>
}> {
  const frames = selection.filter(
    (node): node is FrameNode => node.type === 'FRAME',
  )

  if (frames.length === 0) {
    throw new Error('No frames selected. Please select one or more frames.')
  }

  // Find the bounding box of all selected frames to position duplicates
  let maxX = -Infinity
  let minY = Infinity
  for (const frame of frames) {
    const right = frame.x + frame.width
    if (right > maxX) maxX = right
    if (frame.y < minY) minY = frame.y
  }

  const startX = maxX + DUPLICATE_OFFSET
  const startY = minY

  const processedFrames: FrameNode[] = []
  const unmatchedIcons: string[] = []
  const iconErrors: Array<{
    iconName: string
    error: string
    failedStep: string
    pipeline: PipelineVariant
  }> = []

  // Calculate grid dimensions once before the loop
  const refWidth = frames[0].width
  const refHeight = frames[0].height

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    onProgress(i + 1, frames.length, frame.name)

    // Clone the frame
    const clone = frame.clone()

    // Position clone in grid immediately (before processing) so it's never stacked
    const col = i % GRID_COLUMNS
    const row = Math.floor(i / GRID_COLUMNS)
    clone.x = startX + col * (refWidth + GRID_SPACING)
    clone.y = startY + row * (refHeight + GRID_SPACING)

    // Process the cloned frame through the pipeline
    const result = processFrame(clone, autoAssignCategory)
    if (result.error) {
      iconErrors.push({
        iconName: frame.name,
        error: result.error,
        failedStep: result.failedStep!,
        pipeline: result.pipeline,
      })
      clone.fills = [{ type: 'SOLID', color: { r: 0.953, g: 0.353, b: 0.467 } }]
    } else if (result.unmatched !== null) {
      unmatchedIcons.push(result.unmatched)
    }

    processedFrames.push(clone)

    // Yield to Figma to keep UI responsive
    if (i % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  // Select all processed frames and zoom to fit
  figma.currentPage.selection = processedFrames
  figma.viewport.scrollAndZoomIntoView(processedFrames)

  return { frames: processedFrames, unmatchedIcons, iconErrors }
}
