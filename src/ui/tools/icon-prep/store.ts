// Derived view of the Prepare Icons state slice, so components can read
// `$iconPrepState` without knowing about the AppState envelope.

import { derived, type Readable } from 'svelte/store'
import { appState } from '@ui/store/state'
import type { IconPrepState } from '@tools/icon-prep/types'

export const iconPrepState: Readable<IconPrepState> = derived(
  appState,
  ($s) => $s.tools['icon-prep'],
)
