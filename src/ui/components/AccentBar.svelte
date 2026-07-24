<script lang="ts">
  interface Props {
    /** Raw SVG markup for the leading icon. */
    icon: string
    label: string
  }

  let { icon, label }: Props = $props()
</script>

<div class="accent-bar tint--type-ui-small">
  <span class="icon">{@html icon}</span>
  <span class="label">{label}</span>
</div>

<style lang="sass">
.accent-bar
  display: flex
  align-items: center
  gap: tint.$size-8
  padding: tint.$size-16
  background: var(--tint-action-primary)
  color: var(--tint-action-primary-text)
  flex-shrink: 0

.icon
  display: flex
  flex-shrink: 0
  width: 16px
  height: 16px
  :global(svg)
    width: 100%
    height: 100%

.label
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap
</style>
