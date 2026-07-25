// Drag-resize support: the UI's ResizeHandle sends live width/height as the
// user drags, this clamps them to the shared bounds, applies the resize, and
// persists the result (debounced) so it's restored on the next launch. Ported
// from acorn-annotations, minus its sidebar-width carve-out. this plugin has
// no equivalent sidebar/support view, so the same bounds apply unconditionally.

import {
  MIN_WINDOW_WIDTH,
  MAX_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  MAX_WINDOW_HEIGHT,
} from '@src/defaults'

const STORAGE_KEY = 'windowSize'
const SAVE_DEBOUNCE_MS = 500

let saveTimeout: ReturnType<typeof setTimeout> | null = null

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function debouncedSave(width: number, height: number): void {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    figma.clientStorage.setAsync(STORAGE_KEY, { width, height }).catch(() => {})
  }, SAVE_DEBOUNCE_MS)
}

/** Clamp and apply a size requested by the resize handle, then persist it. */
export function handleResizeWindow(data: {
  width: number
  height: number
}): void {
  const width = clamp(data.width, MIN_WINDOW_WIDTH, MAX_WINDOW_WIDTH)
  const height = clamp(data.height, MIN_WINDOW_HEIGHT, MAX_WINDOW_HEIGHT)
  figma.ui.resize(width, height)
  debouncedSave(width, height)
}

/** Restore the last-saved window size on plugin startup, if any. */
export async function restoreWindowSize(): Promise<void> {
  try {
    const saved = (await figma.clientStorage.getAsync(STORAGE_KEY)) as
      | { width: number; height: number }
      | undefined

    if (
      saved &&
      typeof saved.width === 'number' &&
      typeof saved.height === 'number'
    ) {
      figma.ui.resize(
        clamp(saved.width, MIN_WINDOW_WIDTH, MAX_WINDOW_WIDTH),
        clamp(saved.height, MIN_WINDOW_HEIGHT, MAX_WINDOW_HEIGHT),
      )
    }
  } catch {
    // Ignore storage errors; keep the size figma.showUI already applied.
  }
}
