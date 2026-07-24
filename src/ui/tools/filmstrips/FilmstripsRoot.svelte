<script lang="ts">
  import { filmstripsState } from '@ui/tools/filmstrips/store'
  import { errorStore } from '@ui/store/error'
  import { nav } from '@ui/lib/nav'
  import { TOOLS } from '@tools/registry'
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

  async function handleGenerate() {
    generating = true
    await errorStore.safeRequest('filmstrip:generate', {
      strokeOutput: outlineStrokes ? 'outline' : 'stroke',
    })
    generating = false
  }

  let openImportDialog:
    | ((options?: DialogOptions) => Promise<boolean>)
    | undefined = $state(undefined)
  let importFrameCount = $state('2')

  async function handleImportStrip() {
    const confirmed = await openImportDialog?.()
    if (!confirmed) return
    const frameCount = Math.max(2, parseInt(importFrameCount) || 2)
    await errorStore.safeRequest('filmstrip:import-strip', frameCount)
  }

  // From a result (done/error), back returns to the selection screen instead
  // of exiting the tool — only leave for the menu when already there.
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
  <TextField
    label="Number of frames"
    type="number"
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
  gap: tint.$size-8
  margin: tint.$size-16
  padding: tint.$size-12
  border-radius: tint.$size-4
  background: var(--error-bg)
  color: var(--error-color)
  p
    margin: 0
</style>
