// Backend tool contract. Each tool exports a `register(ctx)` that wires its
// message handlers (via ctx.messenger) and mutates its slice of ctx.state, and
// returns an optional lifecycle object the shell calls on activation, exit, and
// selection changes.

import type { FigmaMessageHandler } from '@src/message-handler'
import type { AppState } from '@src/types'

/** Dependencies injected into every tool's `register()`. */
export interface ToolContext {
  messenger: FigmaMessageHandler
  /** The observable app state — mutate a tool's slice to broadcast to the UI. */
  state: AppState
  /** Normalize a thrown error into a `{ error }` response and log it. */
  handleError: (error: unknown, operation: string) => { error: string }
}

/** Lifecycle hooks the shell invokes for the active tool. */
export interface ToolBackend {
  /** Called when this tool becomes active (after the window resizes). */
  onActivate?: () => void
  /** Called when leaving this tool back to the menu. */
  onDeactivate?: () => void
  /** Called on canvas selection changes while this tool is active. */
  onSelectionChange?: (selection: readonly SceneNode[]) => void
}

/** Signature every tool's backend entry point must satisfy. */
export type ToolRegister = (ctx: ToolContext) => ToolBackend
