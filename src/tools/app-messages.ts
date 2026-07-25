// App-scoped (non-tool-specific) messages: overall state sync, tool navigation,
// and the global canvas selection count. Kept separate from any single tool so
// the shell owns them.

import type {
  FunctionToMessage,
  NotificationMessage,
} from '@src/message-handler'
import type { AppState } from '@src/types'
import type { ToolId } from '@tools/registry'

export interface AppMessages {
  // UI -> Plugin
  /** Hydrate the UI store with the current plugin state on mount. */
  'app:get-state': FunctionToMessage<() => AppState>
  /**
   * Open a tool (or `null` for the menu). A one-way notification. navigation
   * needs no response, and the resulting `app:state-change` broadcast is what
   * the UI reacts to.
   */
  'app:set-tool': NotificationMessage<ToolId | null>
  /** Live width/height from the drag-resize handle; clamped and persisted. */
  'app:resize-window': NotificationMessage<{ width: number; height: number }>

  // Plugin -> UI (notifications)
  /** Broadcast whenever the observable app state changes. */
  'app:state-change': NotificationMessage<AppState>
  /** Broadcast on every canvas selection change (raw node count). */
  'app:selection-changed': NotificationMessage<{ count: number }>
}
