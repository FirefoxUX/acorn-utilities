<script lang="ts">
  interface Props {
    title: string
    description: string
    /** Raw SVG markup for the tile icon. */
    icon: string
    /** Tool accent color (hex). colors the icon and focus/hover so the menu
        previews the same color the tool uses once opened. */
    accent: string
    onclick: () => void
  }

  let { title, description, icon, accent, onclick }: Props = $props()
</script>

<button
  class="tool-tile"
  style={`--tool-accent: ${accent}`}
  {onclick}
  aria-label={title}
>
  <span class="tool-icon">
    {@html icon}
  </span>
  <span class="tool-title tint--type-ui-bold">{title}</span>
  <span class="tool-description tint--type-ui-small">{description}</span>
</button>

<style lang="sass">
.tool-tile
  all: unset
  box-sizing: border-box
  display: flex
  flex-direction: column
  align-items: center
  text-align: center
  gap: var(--tint-size-4)
  padding-block: var(--tint-size-16)
  padding-inline: var(--tint-size-12)
  border: 1px solid var(--tint-card-border)
  border-radius: var(--tint-size-8)
  cursor: pointer
  transition: background 0.15s ease, border-color 0.15s ease
  &:hover
    background: color-mix(in srgb, var(--tool-accent) 8%, transparent)
    border-color: var(--tool-accent)
  &:focus-visible
    outline: 2px solid var(--tool-accent)
    outline-offset: 2px

.tool-icon
  width: var(--tint-size-32)
  height: var(--tint-size-32)
  display: flex
  align-items: center
  justify-content: center
  color: var(--tool-accent)
  margin-block-end: var(--tint-size-4)

.tool-title
  color: var(--tint-text)

.tool-description
  color: var(--tint-text-secondary)
</style>
