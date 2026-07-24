export const PIPELINE_STEPS = [
  { id: 'flatten', name: 'Flatten hierarchy', pipelines: ['standard'] },
  { id: 'clean', name: 'Clean up frame', pipelines: ['standard'] },
  { id: 'classify', name: 'Classify shapes', pipelines: ['standard'] },
  { id: 'combine', name: 'Combine shapes', pipelines: ['standard'] },
  { id: 'finalize', name: 'Finalize shape', pipelines: ['standard'] },
  {
    id: 'validate-duotone',
    name: 'Validate duotone channels',
    pipelines: ['duotone'],
  },
  {
    id: 'flatten-channels',
    name: 'Flatten channels',
    pipelines: ['duotone'],
  },
  {
    id: 'combine-channels',
    name: 'Combine channels',
    pipelines: ['duotone'],
  },
  {
    id: 'finalize-channels',
    name: 'Finalize channels',
    pipelines: ['duotone'],
  },
  { id: 'rename', name: 'Rename frame', pipelines: ['standard', 'duotone'] },
  {
    id: 'categorize',
    name: 'Assign category',
    pipelines: ['standard', 'duotone'],
  },
] as const

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]['id']

export type PipelineVariant = 'standard' | 'duotone'

/** Steps that ran for a given pipeline variant, in order. */
export function stepsFor(variant: PipelineVariant) {
  return PIPELINE_STEPS.filter((step) =>
    (step.pipelines as readonly string[]).includes(variant),
  )
}
