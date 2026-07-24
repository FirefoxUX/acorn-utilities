// Backend for the Prepare Icons tool. Lifts the original monolithic handlers
// (process / reset / set-auto-assign) into a self-contained slice that mutates
// state.tools['icon-prep']; the observable proxy broadcasts the changes.

import type { ToolContext, ToolBackend } from '@code/tools/types'
import { DEFAULT_ICON_PREP_STATE } from '@src/defaults'
import { processSelectedIcons } from './process-icon'

function countIconFrames(selection: readonly SceneNode[]): number {
  return selection.filter((n) => n.type === 'FRAME').length
}

export function registerIconPrep(ctx: ToolContext): ToolBackend {
  const { messenger, state } = ctx
  // The tool's own state slice.
  const s = () => state.tools['icon-prep']

  // Toggle the "assign category automatically" preference.
  messenger.on('icon:set-auto-assign', ({ enabled }) => {
    s().autoAssignCategory = enabled
  })

  // Reset to idle while preserving preferences and the live selection count.
  messenger.on('icon:reset', () => {
    const autoAssign = s().autoAssignCategory
    state.tools['icon-prep'] = {
      ...DEFAULT_ICON_PREP_STATE,
      autoAssignCategory: autoAssign,
      selectionCount: countIconFrames(figma.currentPage.selection),
    }
    return {}
  })

  // Run the full processing pipeline and transition through processing ->
  // done/error.
  messenger.on('icon:process', async () => {
    const selection = figma.currentPage.selection

    if (selection.length === 0) {
      return { error: 'No frames selected.' }
    }

    const frameCount = countIconFrames(selection)
    if (frameCount === 0) {
      return {
        error: 'No frames in selection. Please select frames containing icons.',
      }
    }

    const slice = s()
    slice.view = 'processing'
    slice.progress = 0
    slice.currentIndex = 0
    slice.totalCount = frameCount
    slice.currentIconName = ''
    slice.errorMessage = null
    slice.processedCount = 0

    try {
      const result = await processSelectedIcons(
        selection,
        slice.autoAssignCategory,
        (index, total, name) => {
          const p = s()
          p.currentIndex = index
          p.totalCount = total
          p.currentIconName = name
          p.progress = Math.round((index / total) * 100)
        },
      )

      const successCount = result.frames.length - result.iconErrors.length
      const failCount = result.iconErrors.length

      const done = s()
      done.view = 'done'
      done.progress = 100
      done.processedCount = result.frames.length
      done.currentIconName = ''
      done.unmatchedIcons = result.unmatchedIcons
      done.iconErrors = result.iconErrors

      figma.notify(
        failCount > 0
          ? `Processed ${successCount} of ${result.frames.length} icons (${failCount} failed)`
          : `Processed ${result.frames.length} icons`,
      )

      return {}
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An unknown error occurred'
      const errState = s()
      errState.view = 'error'
      errState.errorMessage = message
      return { error: message }
    }
  })

  return {
    onActivate() {
      // Refresh the selection count when the tool opens.
      s().selectionCount = countIconFrames(figma.currentPage.selection)
    },
    onSelectionChange(selection) {
      // Only track the count while idle (mirrors the original behavior).
      if (s().view === 'idle') {
        s().selectionCount = countIconFrames(selection)
      }
    },
  }
}
