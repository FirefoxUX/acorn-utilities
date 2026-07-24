// UI tool registry: maps each ToolId to its Svelte root component and menu
// icon. This is the only place `.svelte` roots and icon SVGs are imported, so
// they never leak into the plugin (code) bundle. The exhaustive Records force a
// compile error until a new tool is wired on the UI side.

import type { Component } from 'svelte'
import type { ToolId } from '@tools/registry'
import IconPrepRoot from '@ui/tools/icon-prep/IconPrepRoot.svelte'
import FilmstripsRoot from '@ui/tools/filmstrips/FilmstripsRoot.svelte'
import IconProcess from 'tint/icons/20-process.svg?raw'
import IconPlayNext from 'tint/icons/20-play-next.svg?raw'

export const TOOL_COMPONENTS: Record<ToolId, Component> = {
  'icon-prep': IconPrepRoot,
  filmstrips: FilmstripsRoot,
}

/** Raw SVG markup for each tool's menu tile icon. */
export const TOOL_ICONS: Record<ToolId, string> = {
  'icon-prep': IconProcess,
  filmstrips: IconPlayNext,
}
