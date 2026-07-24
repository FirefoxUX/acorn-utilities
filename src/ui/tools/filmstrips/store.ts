// Derived view of the Generate Filmstrips state slice.

import { derived, type Readable } from 'svelte/store'
import { appState } from '@ui/store/state'
import type { FilmstripsState } from '@tools/filmstrips/types'

export const filmstripsState: Readable<FilmstripsState> = derived(
  appState,
  ($s) => $s.tools.filmstrips,
)
