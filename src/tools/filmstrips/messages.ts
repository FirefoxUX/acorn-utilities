// Message contract for the Generate Filmstrips tool. Keys are namespaced with
// the `filmstrip:` prefix so they never collide with other tools' messages.

import type {
  FunctionToMessage,
  NotificationMessage,
} from '@src/message-handler'
import type {
  ColorMapping,
  FilmstripOptions,
  FilmstripResult,
  StoredPause,
} from './types'

export interface FilmstripsMessages {
  /** Bake the selected frame's Motion animation into a filmstrip. */
  'filmstrip:generate': FunctionToMessage<
    (options: FilmstripOptions) => { error?: string; result?: FilmstripResult }
  >
  /** Treat the single selected frame as a ready-made filmstrip. */
  'filmstrip:import-strip': FunctionToMessage<
    (frameCount: number) => { error?: string; result?: FilmstripResult }
  >
  /**
   * Re-render the last generated strip's SVG with a Firefox color mapping
   * applied. Uses the backend's cached scene, so it works without touching
   * the (possibly no-longer-selected) source node again.
   */
  'filmstrip:render-context': FunctionToMessage<
    (mapping: ColorMapping) => { error?: string; svg?: string }
  >
  /** Place the last generated/imported strip on the canvas as a frame. */
  'filmstrip:place-in-figma': FunctionToMessage<
    () => { error?: string; placed?: boolean }
  >
  /** Return the tool to its idle state (clears the last result). */
  'filmstrip:reset': FunctionToMessage<() => { error?: string }>
  /**
   * Persist the current pause list onto the source frame (plugin data), so
   * regenerating or re-importing that frame restores it. Fire-and-forget.
   */
  'filmstrip:save-pauses': NotificationMessage<{ pauses: StoredPause[] }>
}
