// Message contract for the Prepare Icons tool. Keys are namespaced with the
// `icon:` prefix so they never collide with other tools' messages.

import type {
  FunctionToMessage,
  NotificationMessage,
} from '@src/message-handler'

export interface IconPrepMessages {
  /** Run the processing pipeline on the current frame selection. */
  'icon:process': FunctionToMessage<() => { error?: string }>
  /** Reset the tool back to its idle state (preserving preferences). */
  'icon:reset': FunctionToMessage<() => { error?: string }>
  /** Toggle the "assign category automatically" preference. */
  'icon:set-auto-assign': NotificationMessage<{ enabled: boolean }>
}
