// State slice for the Prepare Icons tool. Lifted verbatim from the original
// flat PublicState; now nested under AppState.tools['icon-prep'].

export type IconPrepState = {
  view: 'idle' | 'processing' | 'done' | 'error'
  selectionCount: number
  progress: number
  currentIndex: number
  totalCount: number
  currentIconName: string
  errorMessage: string | null
  processedCount: number
  autoAssignCategory: boolean
  unmatchedIcons: string[]
  iconErrors: Array<{
    iconName: string
    error: string
    failedStep: string
    pipeline: 'standard' | 'duotone'
  }>
}
