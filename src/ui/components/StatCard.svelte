<script lang="ts">
  interface Props {
    value: string
    label: string
  }

  let { value, label }: Props = $props()
</script>

<div class="stat-card">
  <span class="value tint--type-title-sans-2">{value}</span>
  <span class="label tint--type-ui-small">{label}</span>
</div>

<style lang="sass">
.stat-card
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: 2px
  flex: 1
  min-width: 0
  padding-block: var(--tint-size-12)
  padding-inline: var(--tint-size-8)
  border-radius: var(--tint-size-8)
  background: color-mix(in srgb, var(--tint-text) 6%, transparent)
  text-align: center

.value
  color: var(--tint-text)

.label
  color: var(--tint-text-secondary)
</style>
