<script lang="ts">
  import { messenger } from '@src/message-handler'
  import {
    MIN_WINDOW_WIDTH,
    MAX_WINDOW_WIDTH,
    MIN_WINDOW_HEIGHT,
  } from '@src/defaults'

  let isDragging = $state(false)

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }

  function onPointerDown(event: PointerEvent) {
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)
    isDragging = true
  }

  function onPointerMove(event: PointerEvent) {
    if (!isDragging) return

    const width = clamp(
      Math.round(event.clientX + 5),
      MIN_WINDOW_WIDTH,
      MAX_WINDOW_WIDTH,
    )
    const height = Math.max(MIN_WINDOW_HEIGHT, Math.round(event.clientY + 5))

    messenger.notify('app:resize-window', { width, height })
  }

  function onPointerUp(event: PointerEvent) {
    isDragging = false
    const target = event.currentTarget as HTMLElement
    target.releasePointerCapture(event.pointerId)
  }
</script>

<!-- Pointer-drag resize grip: no value or keyboard semantics, so no ARIA role
     applies (a slider role would demand aria-value* that don't fit 2D resize). -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="resize-handle"
  class:dragging={isDragging}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
>
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path
      d="M14 2L2 14"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <path
      d="M14 7L7 14"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <path
      d="M14 12L12 14"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
  </svg>
</div>

<style lang="sass">
  .resize-handle
    position: fixed
    bottom: 0
    right: 0
    width: 20px
    height: 20px
    cursor: nwse-resize
    display: flex
    align-items: center
    justify-content: center
    color: var(--tint-text-secondary)
    opacity: 0.5
    z-index: 100
    touch-action: none
    user-select: none
    &:hover, &.dragging
      opacity: 1
</style>
