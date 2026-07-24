// Bundle-neutral tool registry: the single source of truth for which tools
// exist and their shared, presentation-agnostic metadata. Imported by BOTH the
// plugin (code) and UI bundles, so this file must never import `figma`, any
// `.svelte` component, or any browser/DOM API — it compiles into both bundles
// and the Figma sandbox has no DOM. Keep every field a plain primitive (that is
// why `accent` is a raw hex string, not a token or CSS object). Backend
// `register()` fns live in the code registry (`@code/tools/registry`) and Svelte
// roots/icons live in the UI registry (`@ui/tools/registry`); both are keyed by
// the same `ToolId` defined here.

/** Unique id for every tool in the plugin. Adding a tool starts here. */
export type ToolId = 'icon-prep' | 'filmstrips'

/** Shared, bundle-neutral description of a tool. */
export interface ToolMeta {
  id: ToolId
  /** Menu tile + header title, e.g. "Prepare Icons". */
  title: string
  /** One-line menu subtitle. */
  description: string
  // Hex accent color. Lives here (not in the tool's Svelte root) so the menu
  // tile and the tool view stay the same color and the UI router can theme the
  // active tool from one place. The UI feeds it to `ToolTheme`, which maps it
  // onto tint's action tokens.
  accent: string
}

/** Order tools appear in the main menu. */
export const TOOL_ORDER: ToolId[] = ['icon-prep', 'filmstrips']

// `satisfies` (not a `: Record<…>` annotation) so the compiler still demands an
// entry per `ToolId` — the missing-tool checklist — while keeping each value's
// literal type for callers.
export const TOOLS = {
  'icon-prep': {
    id: 'icon-prep',
    title: 'Prepare Icons',
    description: 'Clean up and categorize selected icon frames.',
    accent: '#5B1031',
  },
  filmstrips: {
    id: 'filmstrips',
    title: 'Generate Filmstrips',
    description: 'Bake a Motion animation into a CSS filmstrip.',
    accent: '#046000',
  },
} satisfies Record<ToolId, ToolMeta>
