<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    /** Bound so callers can wire outside-click-to-close, like the speed menu. */
    element?: HTMLDivElement
    children?: Snippet
    class?: string
  }

  let {
    element = $bindable(undefined),
    children,
    class: className = '',
  }: Props = $props()
</script>

<div class="card {className}" bind:this={element}>
  {@render children?.()}
</div>

<style lang="sass">
.card
  border: 1px solid var(--tint-card-border)
  border-radius: tint.$size-8
  padding: tint.$size-12
</style>
