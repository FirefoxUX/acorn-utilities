import type { AppState } from '@src/types'
import type { IconPrepState } from '@tools/icon-prep/types'
import type { FilmstripsState } from '@tools/filmstrips/types'

// Window sizing: one size for the menu and every tool (no per-tool window
// dimensions). The drag-resize handle clamps to these bounds; values match
// acorn-annotations' main-content bounds.
export const MIN_WINDOW_WIDTH = 300
export const MAX_WINDOW_WIDTH = 550
export const MIN_WINDOW_HEIGHT = 200
export const MAX_WINDOW_HEIGHT = 2000
export const DEFAULT_WINDOW_WIDTH = 360
export const DEFAULT_WINDOW_HEIGHT = 600

export const DEFAULT_ICON_PREP_STATE: IconPrepState = {
  view: 'idle',
  selectionCount: 0,
  progress: 0,
  currentIndex: 0,
  totalCount: 0,
  currentIconName: '',
  errorMessage: null,
  processedCount: 0,
  autoAssignCategory: true,
  unmatchedIcons: [],
  iconErrors: [],
}

export const DEFAULT_FILMSTRIPS_STATE: FilmstripsState = {
  view: 'idle',
  selectionCount: 0,
  info: null,
  options: {
    strokeOutput: 'stroke',
  },
  progress: 0,
  currentFrame: 0,
  totalFrames: 0,
  result: null,
  errorMessage: null,
}

export const DEFAULT_STATE: AppState = {
  activeTool: null,
  tools: {
    'icon-prep': DEFAULT_ICON_PREP_STATE,
    filmstrips: DEFAULT_FILMSTRIPS_STATE,
  },
}
