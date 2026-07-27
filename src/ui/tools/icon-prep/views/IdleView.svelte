<script lang="ts">
  import SelectionScreen from '@ui/components/SelectionScreen.svelte'
  import Button from 'tint/components/Button.svelte'
  import LabeledToggleable from 'tint/components/LabeledToggleable.svelte'
  import illustration from '../assets/illustration.svg?raw'

  let {
    selectionCount,
    autoAssignCategory,
    onProcess,
    onAutoAssignChange,
  }: {
    selectionCount: number
    autoAssignCategory: boolean
    onProcess: () => void
    onAutoAssignChange: (e: { checked: boolean }) => void
  } = $props()
</script>

<div class="idle">
  <SelectionScreen
    {illustration}
    tagline="This tool applies multiple transformations on a selection of frames to flatten and prep icons for use in Figma and production."
  >
    {#snippet description()}
      {#if selectionCount === 0}
        Select unprocessed icon frames on the canvas.
      {:else}
        {selectionCount} frame{selectionCount !== 1 ? 's' : ''} selected
      {/if}
    {/snippet}
    {#snippet upperAction()}
      <Button
        variant="primary"
        onclick={onProcess}
        disabled={selectionCount === 0}
      >
        Process
      </Button>
    {/snippet}
  </SelectionScreen>

  <div class="settings">
    <LabeledToggleable
      id="auto-assign-category"
      type="checkbox"
      checked={autoAssignCategory}
      label="Assign category automatically"
      description="Infer category from the old icon library."
      onchange={onAutoAssignChange}
    />
  </div>
</div>

<style lang="sass">
.idle
  display: flex
  flex-direction: column
  flex: 1
  min-height: 0

.settings
  flex-shrink: 0
  padding: var(--tint-size-16)
  border-block-start: 1px solid var(--tint-card-border)
</style>
