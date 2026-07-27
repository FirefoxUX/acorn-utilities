<script lang="ts">
  import Button from 'tint/components/Button.svelte'
  import IconBack from 'tint/icons/20-chevron-left.svg?raw'
  import IconChevronRight from 'tint/icons/20-chevron-right.svg?raw'
  import IconInfo from 'tint/icons/20-info.svg?raw'
  import IconWarning from 'tint/icons/20-warning.svg?raw'
  import IconProcess from 'tint/icons/20-process.svg?raw'
  import AccentBar from '@ui/components/AccentBar.svelte'
  import Card from '@ui/components/Card.svelte'
  import { iconPrepState as pluginState } from '@ui/tools/icon-prep/store'
  import { PIPELINE_STEPS, stepsFor } from '@tools/icon-prep/pipeline'

  let errorDetailIdx = $state<number | null>(null)

  function stepStatus(
    stepIdx: number,
    failedStepId: string,
    visibleSteps: ReadonlyArray<{ id: string }>,
  ): 'completed' | 'failed' | 'skipped' {
    const failedIdx = visibleSteps.findIndex((s) => s.id === failedStepId)
    if (stepIdx < failedIdx) return 'completed'
    if (stepIdx === failedIdx) return 'failed'
    return 'skipped'
  }

  function stepName(failedStepId: string): string {
    return (
      PIPELINE_STEPS.find((s) => s.id === failedStepId)?.name ?? failedStepId
    )
  }

  const summaryText = $derived(
    $pluginState.iconErrors.length > 0
      ? `Processed ${
          $pluginState.processedCount - $pluginState.iconErrors.length
        } of ${$pluginState.processedCount} icon${
          $pluginState.processedCount !== 1 ? 's' : ''
        } (${$pluginState.iconErrors.length} failed)`
      : `Processed ${$pluginState.processedCount} icon${
          $pluginState.processedCount !== 1 ? 's' : ''
        } successfully`,
  )
</script>

{#if errorDetailIdx !== null}
  {@const iconError = $pluginState.iconErrors[errorDetailIdx]}
  {@const visibleSteps = stepsFor(iconError.pipeline)}
  <div class="body">
    <nav class="detail-nav">
      <Button
        small
        icon
        variant="ghost"
        aria-label="Back"
        onclick={() => (errorDetailIdx = null)}
      >
        {@html IconBack}
      </Button>
      <span class="detail-title tint--type-ui-bold">{iconError.iconName}</span>
      <div class="detail-nav-spacer"></div>
    </nav>

    <p class="tint--type-ui-small errors-description">
      Backgrounds of failed icons are highlighted in red on the canvas.
    </p>

    <div class="detail-pipeline">
      {#each visibleSteps as step, stepIdx (step.id)}
        {@const status = stepStatus(
          stepIdx,
          iconError.failedStep,
          visibleSteps,
        )}
        <div class="detail-step">
          <span class="detail-dot detail-dot--{status}"></span>
          <div class="detail-step-info">
            <span
              class="detail-step-name tint--type-ui-small"
              class:detail-step-name--failed={status === 'failed'}
              >{step.name}</span
            >
            {#if status === 'failed'}
              <span class="detail-step-error tint--type-ui-small"
                >{iconError.error}</span
              >
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
{:else}
  <AccentBar icon={IconProcess} label={summaryText} />

  <div class="body">
    {#if $pluginState.iconErrors.length > 0}
      <Card>
        <div class="errors-section">
          <p class="tint--type-ui-bold">
            {$pluginState.iconErrors.length} icon{$pluginState.iconErrors
              .length !== 1
              ? 's'
              : ''} failed to process:
          </p>
          <p class="tint--type-ui-small errors-description">
            Backgrounds of failed icons are highlighted in red on the canvas.
          </p>
          <ul class="errors-list">
            {#each $pluginState.iconErrors as iconError, idx (idx)}
              <li class="error-item">
                <button
                  class="error-button"
                  onclick={() => (errorDetailIdx = idx)}
                >
                  <span class="category-icon category-icon--error">
                    {@html IconWarning}
                  </span>
                  <div class="error-info">
                    <span class="error-icon-name tint--type-ui-small"
                      >{iconError.iconName}</span
                    >
                    <span class="error-failed-step tint--type-ui-small"
                      >{stepName(iconError.failedStep)}</span
                    >
                  </div>
                  <span class="error-chevron">
                    {@html IconChevronRight}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        </div>
      </Card>
    {/if}

    {#if $pluginState.unmatchedIcons.length > 0}
      <Card>
        <div class="unmatched-section">
          <p class="tint--type-ui-bold">
            Could not assign category for {$pluginState.unmatchedIcons.length} icon{$pluginState
              .unmatchedIcons.length !== 1
              ? 's'
              : ''}:
          </p>
          <p class="tint--type-ui-small unmatched-description">
            Backgrounds of unmatched icons are highlighted in yellow on the
            canvas.
          </p>
          <div class="unmatched-list">
            {#each $pluginState.unmatchedIcons as iconName (iconName)}
              <div class="unmatched-item">
                <span class="category-icon category-icon--warning">
                  {@html IconInfo}
                </span>
                <span class="tint--type-ui-small">{iconName}</span>
              </div>
            {/each}
          </div>
        </div>
      </Card>
    {/if}
  </div>
{/if}

<style lang="sass">
.body
  display: flex
  flex-direction: column
  gap: var(--tint-size-12)
  padding: var(--tint-size-16)

.errors-section
  display: flex
  flex-direction: column
  gap: var(--tint-size-4)

.errors-description,
.unmatched-description
  color: var(--tint-text-secondary)

.errors-list
  list-style: none
  margin: 0
  padding: 0

.error-item
  border-block-end: 1px solid var(--tint-card-border)
  &:last-child
    border-block-end: none

.error-button
  all: unset
  display: flex
  align-items: center
  gap: var(--tint-size-8)
  width: 100%
  box-sizing: border-box
  padding: var(--tint-size-8)
  cursor: pointer
  transition: background 0.15s ease
  &:hover
    background: var(--tint-action-secondary-hover)

.error-info
  display: flex
  flex-direction: column
  gap: 2px
  flex: 1
  min-width: 0

.error-icon-name
  font-weight: 500
  color: var(--tint-text-error)
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap

.error-failed-step
  color: var(--tint-text-secondary)

.category-icon
  width: 24px
  height: 24px
  aspect-ratio: 1
  border-radius: 50%
  display: flex
  align-items: center
  justify-content: center
  flex-shrink: 0

.category-icon--warning
  background: var(--warning-bg)
  color: var(--warning-color)

.category-icon--error
  background: var(--error-bg)
  color: var(--error-color)

.error-chevron
  width: var(--tint-size-24)
  height: var(--tint-size-24)
  display: flex
  align-items: center
  justify-content: center
  flex-shrink: 0
  color: var(--tint-text-secondary)

.detail-nav
  display: flex
  align-items: center
  gap: var(--tint-size-8)
  margin-block: 0
  margin-inline: (- var(--tint-size-16))
  padding-block: 0 var(--tint-size-8)
  padding-inline: var(--tint-size-16)
  border-block-end: 1px solid var(--tint-card-border)

.detail-title
  flex: 1
  text-align: center
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap

.detail-nav-spacer
  width: 28px

.detail-pipeline
  display: flex
  flex-direction: column
  gap: var(--tint-size-12)

.detail-step
  display: flex
  align-items: flex-start
  gap: var(--tint-size-8)

.detail-dot
  width: 10px
  height: 10px
  border-radius: 50%
  flex-shrink: 0
  margin-block-start: 3px

.detail-dot--completed
  background: var(--tint-text)
  opacity: 0.3

.detail-dot--failed
  background: var(--error-color)

.detail-dot--skipped
  border: 1.5px solid var(--tint-text)
  opacity: 0.2

.detail-step-info
  display: flex
  flex-direction: column
  gap: 1px
  min-width: 0

.detail-step-name
  color: var(--tint-text-secondary)

.detail-step-name--failed
  color: var(--tint-text-error)
  font-weight: 500

.detail-step-error
  color: var(--tint-text-secondary)
  word-break: break-word

.unmatched-section
  display: flex
  flex-direction: column
  gap: var(--tint-size-4)

.unmatched-item
  display: flex
  align-items: center
  gap: var(--tint-size-8)

.unmatched-list
  max-height: 120px
  overflow-y: auto
  display: flex
  flex-direction: column
  gap: var(--tint-size-2)
</style>
