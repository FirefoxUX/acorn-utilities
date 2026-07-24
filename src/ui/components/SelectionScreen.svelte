<script lang="ts">
  import type { Snippet } from 'svelte'
  import IconSelect from 'tint/icons/20-select.svg?raw'

  interface Props {
    /** Raw SVG markup for the panel illustration. */
    illustration: string
    /** Bold explainer shown under the description, e.g. what the tool does. */
    tagline: string
    /** Selection-state-aware instructions, rendered under the badge. */
    description?: Snippet
    /** Rendered between the description and the tagline (e.g. a Process CTA). */
    upperAction?: Snippet
    /** Rendered at the bottom of the screen (e.g. a secondary Import action). */
    lowerAction?: Snippet
  }

  let { illustration, tagline, description, upperAction, lowerAction }: Props =
    $props()
</script>

<div class="selection-screen">
  <div class="panel">
    <div class="illustration-clip">
      <div class="illustration">
        {@html illustration}
      </div>
    </div>
    <div class="badge">
      {@html IconSelect}
    </div>
  </div>

  <div class="body">
    {#if description}
      <div class="description tint--type-ui-small">
        {@render description()}
      </div>
    {/if}

    {#if upperAction}
      <div class="upper-action">
        {@render upperAction()}
      </div>
    {/if}

    <p class="tagline tint--type-ui-bold">{tagline}</p>

    <div class="spacer"></div>

    {#if lowerAction}
      <div class="lower-action">
        {@render lowerAction()}
      </div>
    {/if}
  </div>
</div>

<style lang="sass">
.selection-screen
  display: flex
  flex-direction: column
  flex: 1
  min-height: 0

.panel
  position: relative
  flex-shrink: 0
  height: 220px
  background: var(--tint-action-primary)

.illustration-clip
  position: absolute
  inset: 0
  display: flex
  align-items: center
  justify-content: center
  overflow: hidden

.illustration
  display: flex
  :global(svg)
    width: 100%
    height: auto
    max-width: 260px

.badge
  position: absolute
  bottom: 0
  left: 50%
  z-index: 1
  transform: translate(-50%, 50%)
  width: 64px
  height: 64px
  border-radius: 50%
  background: var(--tint-bg)
  border: 2px solid var(--tint-action-primary)
  display: flex
  align-items: center
  justify-content: center
  color: var(--tint-action-primary)
  :global(svg)
    width: 24px
    height: 24px

.body
  display: flex
  flex-direction: column
  align-items: center
  flex: 1
  min-height: 0
  gap: tint.$size-16
  padding: tint.$size-40 tint.$size-24 tint.$size-16
  text-align: center
  overflow-y: auto

.description
  color: var(--tint-text-secondary)

.tagline
  color: var(--tint-text)

.spacer
  flex: 1
  min-height: 0

.upper-action,
.lower-action
  display: flex
  justify-content: center
</style>
