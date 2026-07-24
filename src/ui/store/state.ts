// Syncs the whole plugin state tree to the UI. On first subscription it fires
// an `app:get-state` request to hydrate, then stays live via `app:state-change`
// notifications. Tools read their own slice via derived stores (see each tool's
// store.ts) rather than reaching into this directly.

import { readable, type Readable } from 'svelte/store'
import { messenger } from '@src/message-handler'
import type { AppState } from '@src/types'
import { DEFAULT_STATE } from '@src/defaults'

export const appState: Readable<AppState> = readable<AppState>(
  DEFAULT_STATE,
  (set) => {
    messenger
      .request('app:get-state')
      .then((initialState) => {
        set(initialState)
      })
      .catch((error) => {
        console.error('Failed to get initial state:', error)
      })

    const unsubscribe = messenger.on('app:state-change', (newState) => {
      set(newState)
    })

    return unsubscribe
  },
)
