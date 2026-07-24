<script lang="ts">
  import type { Snippet } from 'svelte'
  import Button from 'tint/components/Button.svelte'
  import IconBack from 'tint/icons/20-chevron-left.svg?raw'

  interface Props {
    title?: string
    onBack?: () => void
    backLabel?: string
    actions?: Snippet
  }

  let { title = '', onBack, backLabel = 'Back', actions }: Props = $props()
</script>

<header class="view-header">
  <div class="leading">
    {#if onBack}
      <Button
        icon
        small
        variant="ghost"
        aria-label={backLabel}
        tooltip={backLabel}
        onclick={onBack}
      >
        {@html IconBack}
      </Button>
    {/if}
    {#if title}
      <h1 class="tint--type-body-bold">{title}</h1>
    {/if}
  </div>
  {#if actions}
    <div class="actions">
      {@render actions()}
    </div>
  {/if}
</header>

<style lang="sass">
.view-header
  display: flex
  align-items: center
  justify-content: space-between
  gap: tint.$size-8
  padding: tint.$size-8 tint.$size-12
  border-bottom: 1px solid var(--tint-card-border)
  min-height: 48px
  box-sizing: border-box
  flex-shrink: 0

.leading
  display: flex
  align-items: center
  gap: tint.$size-8
  min-width: 0

h1
  margin: 0
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis

.actions
  display: flex
  align-items: center
  gap: tint.$size-4
  flex-shrink: 0
</style>
