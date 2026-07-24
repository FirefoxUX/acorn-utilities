// Navigation framework (tier 1: menu <-> tool). The backend's `activeTool` is
// the source of truth, so navigation is a thin wrapper over `app:set-tool`.
// A tool's internal sub-views (tier 2) are owned by that tool's own state.

import { get } from 'svelte/store'
import { messenger } from '@src/message-handler'
import { appState } from '@ui/store/state'
import type { ToolId } from '@tools/registry'

export const nav = {
  /** Open a tool by id (backend activates it). */
  openTool: (id: ToolId) => messenger.notify('app:set-tool', id),
  /** Return to the main menu. */
  backToMenu: () => messenger.notify('app:set-tool', null),
  /** The currently active tool, or null when on the menu. */
  activeTool: (): ToolId | null => get(appState).activeTool,
}
