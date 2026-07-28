<script lang="ts">
  import { filmstripsState } from '@ui/tools/filmstrips/store'
  import { messenger } from '@src/message-handler'
  import { errorStore } from '@ui/store/error'
  import { nav } from '@ui/lib/nav'
  import { TOOLS } from '@tools/registry'
  import type { FrameCountSuggestion } from '@tools/filmstrips/types'
  import Button from 'tint/components/Button.svelte'
  import Dialog, { type DialogOptions } from 'tint/components/Dialog.svelte'
  import TextField from 'tint/components/TextField.svelte'
  import Header from '@ui/components/Header.svelte'
  import IdleView from './views/IdleView.svelte'
  import ReadyView from './views/ReadyView.svelte'
  import ProcessingView from './views/ProcessingView.svelte'
  import DoneView from './views/DoneView.svelte'

  let outlineStrokes = $state(
    $filmstripsState.options.strokeOutput === 'outline',
  )
  let generating = $state(false)

  const view = $derived($filmstripsState.view)
  const info = $derived($filmstripsState.info)

  // Writable derived: the loop toggle defaults to the detected value and resets
  // when the selection changes (info recomputes), but a manual toggle overrides
  // it until then. info is stable within one selection.
  let loop = $derived(info?.loops ?? true)

  async function handleGenerate() {
    generating = true
    await errorStore.safeRequest('filmstrip:generate', {
      strokeOutput: outlineStrokes ? 'outline' : 'stroke',
      loop,
    })
    generating = false
  }

  let openImportDialog:
    | ((options?: DialogOptions) => Promise<boolean>)
    | undefined = $state(undefined)
  let importFrameCount = $state('2')
  let frameSuggestions = $state<FrameCountSuggestion[]>([])

  async function handleImportStrip() {
    // Offer guessed counts as chips and preselect the first, so the field and a
    // chip start in sync; the user can click another chip or type their own.
    frameSuggestions = await messenger.request(
      'filmstrip:frame-count-suggestions',
    )
    importFrameCount = String(frameSuggestions[0]?.value ?? 2)
    const confirmed = await openImportDialog?.()
    if (!confirmed) return
    const frameCount = Math.max(2, parseInt(importFrameCount) || 2)
    await errorStore.safeRequest('filmstrip:import-strip', frameCount)
  }

  // From a result (done/error), back returns to the selection screen instead
  // of exiting the tool. only leave for the menu when already there.
  function handleBack() {
    if (view === 'done' || view === 'error') {
      errorStore.safeRequest('filmstrip:reset')
    } else {
      nav.backToMenu()
    }
  }
</script>

<div class="tool">
  <Header title={TOOLS.filmstrips.title} onBack={handleBack} />

  <div class="content">
    {#if view === 'idle'}
      {#if info?.hasAnimation}
        <ReadyView
          {info}
          bind:outlineStrokes
          bind:loop
          {generating}
          onGenerate={handleGenerate}
        />
      {:else}
        <IdleView onImportStrip={handleImportStrip} />
      {/if}
    {:else if view === 'processing'}
      <ProcessingView />
    {:else if view === 'done'}
      <DoneView />
    {:else if view === 'error'}
      <div class="error-box tint--type-ui">
        <p>{$filmstripsState.errorMessage ?? 'Something went wrong.'}</p>
        <Button
          small
          variant="secondary"
          onclick={() => errorStore.safeRequest('filmstrip:reset')}
        >
          Try again
        </Button>
      </div>
    {/if}
  </div>
</div>

<Dialog
  bind:openDialog={openImportDialog}
  variant="transaction"
  heading="Import filmstrip"
  actionLabel="Import"
>
  {#if frameSuggestions.length > 0}
    <div class="frame-suggestions">
      <span class="tint--type-ui-small suggestions-label">Suggested</span>
      <div class="chips">
        {#each frameSuggestions as suggestion (suggestion.label)}
          <Button
            small
            variant="secondary"
            toggled={importFrameCount === String(suggestion.value)}
            onclick={() => (importFrameCount = String(suggestion.value))}
          >
            {suggestion.value} · {suggestion.label.toLowerCase()}
          </Button>
        {/each}
      </div>
    </div>
  {/if}
  <TextField
    label="Number of frames"
    type="number"
    min={2}
    step={1}
    bind:value={importFrameCount}
    helperText="How many equal-width cells make up the selected strip."
  />
</Dialog>

<style lang="sass">
.tool
  display: flex
  flex-direction: column
  flex: 1
  min-height: 0

.content
  display: flex
  flex-direction: column
  flex: 1
  overflow-y: auto
  min-height: 0

.error-box
  display: flex
  flex-direction: column
  align-items: flex-start
  gap: var(--tint-size-8)
  margin: var(--tint-size-16)
  padding: var(--tint-size-12)
  border-radius: var(--tint-size-4)
  background: var(--error-bg)
  color: var(--error-color)
  p
    margin: 0

.frame-suggestions
  display: flex
  flex-direction: column
  gap: var(--tint-size-4)
  margin-block-end: var(--tint-size-12)

.suggestions-label
  color: var(--tint-text-secondary)

.chips
  display: flex
  flex-wrap: wrap
  gap: var(--tint-size-8)
</style>
