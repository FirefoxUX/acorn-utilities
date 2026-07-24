// Top-level plugin state. `activeTool` drives the shell router (null = main
// menu); each tool owns an isolated slice under `tools` so their view/selection
// concerns never collide. Defined as a type literal (not an interface) so it
// carries an implicit index signature and satisfies createObservableState's
// `Record<string, unknown>` constraint.

import type { ToolId } from '@tools/registry'
import type { IconPrepState } from '@tools/icon-prep/types'
import type { FilmstripsState } from '@tools/filmstrips/types'

export type AppState = {
  activeTool: ToolId | null
  tools: {
    'icon-prep': IconPrepState
    filmstrips: FilmstripsState
  }
}
