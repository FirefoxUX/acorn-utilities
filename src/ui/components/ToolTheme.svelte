<script lang="ts">
  import type { Snippet } from 'svelte'
  import { darken } from '@ui/lib/color'

  interface Props {
    /** Tool accent color (hex). Drives every tint action/CTA color beneath it. */
    accent: string
    children?: Snippet
  }

  let { accent, children }: Props = $props()

  // Primary buttons are solid fills, so hover/active have to shift the fill
  // itself. Derive them by dropping HSL lightness a fixed amount (see `darken`)
  // rather than a CSS `color-mix` toward black, which scales channels
  // proportionally and barely moves a dark accent like #5B1031. leaving
  // hover/active looking identical to the base.
  const primaryHover = $derived(darken(accent, 6))
  const primaryActive = $derived(darken(accent, 11))
</script>

<div
  class="tool-theme"
  style={`--tool-accent: ${accent}; --tool-accent-hover: ${primaryHover}; --tool-accent-active: ${primaryActive}`}
>
  {@render children?.()}
</div>

<style lang="sass">
.tool-theme
  --tint-action-primary: var(--tool-accent)
  --tint-action-primary-text: #fff
  --tint-action-primary-hover: var(--tool-accent-hover)
  --tint-action-primary-active: var(--tool-accent-active)
  --tint-action-secondary: var(--tool-accent)
  --tint-action-secondary-text: var(--tool-accent)
  --tint-action-secondary-hover: color-mix(in srgb, var(--tool-accent) 12%, transparent)
  --tint-action-secondary-active: color-mix(in srgb, var(--tool-accent) 22%, transparent)
  display: flex
  flex-direction: column
  flex: 1
  min-height: 0
  // Pill-shaped CTAs, matching the tool mockups (tint's default is a 12px
  // rounded rect; only `small` buttons get the full pill radius otherwise).
  :global(.tint--button)
    border-radius: 999px
</style>
