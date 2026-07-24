// Raw canvas selection count, broadcast globally regardless of active tool
// (see `app:selection-changed` in code/index.ts). Distinct from a tool's own
// `selectionCount` slice, which may filter for tool-specific criteria (e.g.
// filmstrips only counts frames carrying a Motion animation).

import { readable, type Readable } from 'svelte/store'
import { messenger } from '@src/message-handler'

export const rawSelectionCount: Readable<number> = readable(0, (set) => {
  return messenger.on('app:selection-changed', ({ count }) => set(count))
})
