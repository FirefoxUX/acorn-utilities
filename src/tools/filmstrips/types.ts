// State + contracts for the Generate Filmstrips tool. Bundle-neutral: no figma
// or Svelte imports (shared by both the plugin and UI bundles).

/** Fixed sampling rate for baking — no longer user-configurable. */
export const FILMSTRIP_FPS = 60

/** Guardrail against runaway atlases (huge N → giant SVG). */
export const MAX_FILMSTRIP_FRAMES = 120

/** User-configurable generation options. */
export type FilmstripOptions = {
  /** How strokes are drawn: an SVG stroke, or a flattened filled outline. */
  strokeOutput: 'stroke' | 'outline'
}

/**
 * How a literal color should paint in the Firefox export. Firefox icons treat
 * `context-fill` as the default/primary color and `context-stroke` as a
 * secondary color used only when an icon needs two tones — not a literal
 * mapping of SVG fills to `context-fill` and strokes to `context-stroke`.
 * `literal` keeps that color hardcoded (e.g. a color that must never re-tint).
 */
export type ColorRole = 'context-fill' | 'context-stroke' | 'literal'

/** hex ("#rrggbb") -> role. A color missing from the map defaults to `context-fill`. */
export type ColorMapping = Record<string, ColorRole>

/** Cheap, cloning-free summary of the current selection's Motion animation. */
export type SelectionMotionInfo = {
  name: string
  hasAnimation: boolean
  timelineDurationMs: number
  /** Keyframes exist on descendants (only the top-level node is baked in v1). */
  nestedKeyframesPresent: boolean
  /** Human-readable caveats for the selection (springs approximated, etc.). */
  unsupportedNotes: string[]
}

/** The generated artifact + metadata, returned to the UI and stored in state. */
export type FilmstripResult = {
  /** Standard, literal-color SVG. */
  svg: string
  /**
   * Distinct literal colors (fills + strokes) found in the artifact, for the
   * Firefox color-role picker. Null for imported strips, whose original
   * paints can't be separated back out of the flat exported markup.
   */
  colors: string[] | null
  css: string
  width: number
  height: number
  cellW: number
  cellH: number
  frameCount: number
  durationMs: number
  /** The layer name the strip was generated or imported from. */
  sourceName: string
  placedInFigma: boolean
}

export type FilmstripsState = {
  view: 'idle' | 'processing' | 'done' | 'error'
  /** Number of selected frames that carry a Motion animation (0 or 1 in v1). */
  selectionCount: number
  info: SelectionMotionInfo | null
  options: FilmstripOptions
  progress: number // 0..100
  currentFrame: number
  totalFrames: number
  result: FilmstripResult | null
  errorMessage: string | null
}
