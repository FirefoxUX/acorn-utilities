<script lang="ts">
  import { iconPrepState } from '@ui/tools/icon-prep/store'
  import { errorStore } from '@ui/store/error'
  import { messenger } from '@src/message-handler'
  import { nav } from '@ui/lib/nav'
  import { TOOLS } from '@tools/registry'
  import Button from 'tint/components/Button.svelte'
  import Header from '@ui/components/Header.svelte'
  import IdleView from './views/IdleView.svelte'
  import ProcessingView from './views/ProcessingView.svelte'
  import DoneView from './views/DoneView.svelte'

  // Mirror of the auto-assign preference for immediate toggle feedback; the
  // writable $derived lets us optimistically reassign on toggle, then re-syncs
  // to the plugin state slice whenever it changes.
  let autoAssignCategory = $derived($iconPrepState.autoAssignCategory)

  const selectionCount = $derived($iconPrepState.selectionCount)
  const view = $derived($iconPrepState.view)

  function handleAutoAssignChange({ checked }: { checked: boolean }) {
    autoAssignCategory = checked
    messenger.notify('icon:set-auto-assign', { enabled: checked })
  }

  function handleProcess() {
    errorStore.safeRequest('icon:process')
  }

  function handleReset() {
    errorStore.safeRequest('icon:reset')
  }

  // From a result (done/error), back returns to the selection screen instead
  // of exiting the tool — only leave for the menu when already there.
  function handleBack() {
    if (view === 'done' || view === 'error') {
      handleReset()
    } else {
      nav.backToMenu()
    }
  }
</script>

<div class="tool">
  <Header title={TOOLS['icon-prep'].title} onBack={handleBack} />

  <div class="content">
    {#if view === 'idle'}
      <IdleView
        {selectionCount}
        {autoAssignCategory}
        onProcess={handleProcess}
        onAutoAssignChange={handleAutoAssignChange}
      />
    {:else if view === 'processing'}
      <ProcessingView />
    {:else if view === 'done'}
      <DoneView />
    {:else if view === 'error'}
      <div class="error-box tint--type-ui">
        <p>{$iconPrepState.errorMessage ?? 'Something went wrong.'}</p>
        <Button small variant="secondary" onclick={handleReset}>
          Try again
        </Button>
      </div>
    {/if}
  </div>
</div>

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
