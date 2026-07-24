// Backend for the Generate Filmstrips tool. Populates cheap Motion info on
// selection changes (for the idle view) and runs the baking pipeline on
// `filmstrip:generate`, mutating state.tools.filmstrips to drive the UI.

import type { ToolContext, ToolBackend } from '@code/tools/types'
import { inspectNode, collectAnimated } from './inspect'
import { generateFilmstrip, type CachedScene } from './generate'
import { importStrip } from './import-strip'
import { placeFilmstripInFigma } from './place-in-figma'
import { renderWithColorMapping } from './render-context'
import { buildCss } from './css'
import { PAUSES_KEY } from './pauses-meta'

/**
 * Selected nodes whose subtree carries a Motion animation. Motion keyframes
 * live on the animated layers themselves (often nested), so we check the whole
 * subtree, not just the selected node.
 */
function animatedFrames(selection: readonly SceneNode[]): SceneNode[] {
  return selection.filter((n) => collectAnimated(n).length > 0)
}

export function registerFilmstrips(ctx: ToolContext): ToolBackend {
  const { messenger, state, handleError } = ctx
  const s = () => state.tools.filmstrips

  // Refresh the cheap Motion summary for the current selection.
  function refresh(selection: readonly SceneNode[]) {
    const animated = animatedFrames(selection)
    s().selectionCount = animated.length
    s().info = animated.length === 1 ? inspectNode(animated[0]) : null
  }

  // The scene behind the current result, kept around so the Firefox
  // color-mapping picker can re-render without re-reading Figma geometry.
  // Null for imported strips (no separable colors) or once superseded.
  let cachedScene: CachedScene | null = null

  // Id of the frame the current result was generated/imported from — the target
  // for persisting pause edits. Its own lifetime (set on generate AND import,
  // cleared on reset), independent of cachedScene which is null for imports.
  let sourceNodeId: string | null = null

  messenger.on('filmstrip:reset', () => {
    const slice = s()
    slice.view = 'idle'
    slice.result = null
    slice.errorMessage = null
    slice.progress = 0
    slice.currentFrame = 0
    slice.totalFrames = 0
    cachedScene = null
    sourceNodeId = null
    refresh(figma.currentPage.selection)
    return {}
  })

  messenger.on('filmstrip:generate', async (options) => {
    const animated = animatedFrames(figma.currentPage.selection)
    if (animated.length === 0) {
      return { error: 'Select a frame that has a Figma Motion animation.' }
    }
    if (animated.length > 1) {
      return { error: 'Select a single animated frame (multiple selected).' }
    }

    const slice = s()
    slice.view = 'processing'
    slice.progress = 0
    slice.currentFrame = 0
    slice.totalFrames = 0
    slice.errorMessage = null

    try {
      const { data, cached } = await generateFilmstrip(
        animated[0],
        options,
        (current, total) => {
          const p = s()
          p.currentFrame = current
          p.totalFrames = total
          p.progress = Math.round((current / total) * 100)
        },
      )
      cachedScene = cached
      sourceNodeId = animated[0].id

      const css = buildCss({
        cellW: data.cellW,
        cellH: data.cellH,
        frameCount: data.frameCount,
        durationMs: data.durationMs,
      })
      const result = { ...data, css, placedInFigma: false }

      const done = s()
      done.view = 'done'
      done.progress = 100
      done.result = result

      figma.notify(`Generated a ${data.frameCount}-frame filmstrip`)
      return { result }
    } catch (error) {
      const { error: message } = handleError(error, 'filmstrip:generate')
      const errState = s()
      errState.view = 'error'
      errState.errorMessage = message
      return { error: message }
    }
  })

  messenger.on('filmstrip:import-strip', async (frameCount) => {
    const selection = figma.currentPage.selection
    if (selection.length !== 1) {
      return { error: 'Select a single existing filmstrip frame.' }
    }

    try {
      const data = await importStrip(selection[0], frameCount)
      cachedScene = null
      sourceNodeId = selection[0].id
      const css = buildCss({
        cellW: data.cellW,
        cellH: data.cellH,
        frameCount: data.frameCount,
        durationMs: data.durationMs,
      })
      const result = { ...data, css, placedInFigma: false }

      const done = s()
      done.view = 'done'
      done.progress = 100
      done.result = result

      figma.notify(`Imported a ${data.frameCount}-frame filmstrip`)
      return { result }
    } catch (error) {
      const { error: message } = handleError(error, 'filmstrip:import-strip')
      const errState = s()
      errState.view = 'error'
      errState.errorMessage = message
      return { error: message }
    }
  })

  messenger.on('filmstrip:render-context', (mapping) => {
    if (!cachedScene) {
      return { error: 'No Firefox color mapping available for this strip.' }
    }
    try {
      return { svg: renderWithColorMapping(cachedScene, mapping) }
    } catch (error) {
      return handleError(error, 'filmstrip:render-context')
    }
  })

  messenger.on('filmstrip:place-in-figma', () => {
    const slice = s()
    const result = slice.result
    if (!result) return { error: 'Nothing to place yet.' }

    try {
      placeFilmstripInFigma(result.svg, result.sourceName)
      slice.result = { ...result, placedInFigma: true }
      figma.notify('Placed the filmstrip on the canvas')
      return { placed: true }
    } catch (error) {
      return handleError(error, 'filmstrip:place-in-figma')
    }
  })

  // Persist pause edits onto the source frame. Fire-and-forget: the UI sends the
  // current list on each discrete edit. Async node lookup is required under
  // `documentAccess: "dynamic-page"` (sync getNodeById throws there).
  messenger.on('filmstrip:save-pauses', async ({ pauses }) => {
    if (!sourceNodeId) return
    const next = pauses.length ? JSON.stringify(pauses) : ''
    try {
      const node = await figma.getNodeByIdAsync(sourceNodeId)
      if (!node || node.removed || !('setPluginData' in node)) return
      // Skip a no-op write so unchanged saves don't churn the undo stack.
      if (node.getPluginData(PAUSES_KEY) === next) return
      node.setPluginData(PAUSES_KEY, next)
    } catch {
      // Best-effort: the node may be gone or on an unloaded page.
    }
  })

  return {
    onActivate() {
      refresh(figma.currentPage.selection)
    },
    onSelectionChange(selection) {
      // Only the idle/ready screen tracks the live canvas selection. Once a
      // strip is generated (done) — or while processing / after an error —
      // the view is sticky: selecting, deselecting, or reselecting frames on
      // the canvas must not discard the result or bounce out of it (the user
      // is likely editing pauses or reading the result). They return to the
      // ready screen with the Back button, which resets to idle.
      if (s().view === 'idle') refresh(selection)
    },
  }
}
