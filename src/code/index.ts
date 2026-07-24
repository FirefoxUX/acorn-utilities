// Plugin entry point (thin shell). Creates the observable app state, opens the
// window, registers every tool's backend from the registry, and owns the
// app-scoped messages: state hydration, tool navigation, drag-resize, and
// global selection routing to the active tool.

import { messenger } from '@src/message-handler'
import type { AppState } from '@src/types'
import {
  DEFAULT_STATE,
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
} from '@src/defaults'
import { createObservableState } from '@code/utils'
import { TOOL_ORDER, type ToolId } from '@tools/registry'
import { TOOL_BACKENDS } from '@code/tools/registry'
import type { ToolBackend } from '@code/tools/types'
import { handleResizeWindow, restoreWindowSize } from '@code/window'

// Observable state: any mutation to a tool's slice batch-broadcasts to the UI.
const state = createObservableState<AppState>(DEFAULT_STATE, (s) => {
  messenger.notify('app:state-change', s)
})

function handleError(error: unknown, operation: string): { error: string } {
  const message =
    error instanceof Error ? error.message : 'An unknown error occurred'
  console.error(`[${operation}]`, error)
  return { error: message }
}

// Open at the default size, then restore any size the user dragged to on a
// previous launch (same size for the menu and every tool).
figma.showUI(__html__, {
  width: DEFAULT_WINDOW_WIDTH,
  height: DEFAULT_WINDOW_HEIGHT,
})
restoreWindowSize()

const backends: Record<ToolId, ToolBackend> = {} as Record<ToolId, ToolBackend>
for (const id of TOOL_ORDER) {
  backends[id] = TOOL_BACKENDS[id]({ messenger, state, handleError })
}

// Hydrate the UI store on mount.
messenger.on('app:get-state', () => state)

messenger.on('app:resize-window', handleResizeWindow)

// Open a tool (or return to the menu when id is null): deactivate the
// previous tool, switch state, then activate the new tool.
messenger.on('app:set-tool', (id) => {
  const prev = state.activeTool
  if (prev) backends[prev]?.onDeactivate?.()

  state.activeTool = id

  if (id) backends[id]?.onActivate?.()
})

// Broadcast raw selection count globally and route to the active tool.
figma.on('selectionchange', () => {
  const selection = figma.currentPage.selection
  messenger.notify('app:selection-changed', { count: selection.length })

  const active = state.activeTool
  if (active) backends[active]?.onSelectionChange?.(selection)
})
