// Backend tool registry: maps each ToolId to its `register()` entry point.
// This is the only place backend tool modules are imported, keeping the
// bootstrapper generic. The exhaustive Record forces a compile error until a
// new tool is wired on the backend.

import type { ToolId } from '@tools/registry'
import type { ToolRegister } from '@code/tools/types'
import { registerIconPrep } from '@code/tools/icon-prep'
import { registerFilmstrips } from '@code/tools/filmstrips'

export const TOOL_BACKENDS: Record<ToolId, ToolRegister> = {
  'icon-prep': registerIconPrep,
  filmstrips: registerFilmstrips,
}
