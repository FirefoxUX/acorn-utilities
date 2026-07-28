<script lang="ts">
  import Button from 'tint/components/Button.svelte'
  import LabeledToggleable from 'tint/components/LabeledToggleable.svelte'
  import AccentBar from '@ui/components/AccentBar.svelte'
  import StatCard from '@ui/components/StatCard.svelte'
  import IconPlay from 'tint/icons/20-play.svg?raw'
  import {
    FILMSTRIP_FPS,
    MAX_FILMSTRIP_FRAMES,
    type SelectionMotionInfo,
  } from '@tools/filmstrips/types'

  let {
    info,
    outlineStrokes = $bindable(),
    loop = $bindable(),
    generating,
    onGenerate,
  }: {
    info: SelectionMotionInfo
    outlineStrokes: boolean
    loop: boolean
    generating: boolean
    onGenerate: () => void
  } = $props()

  const durationSec = $derived(info.timelineDurationMs / 1000)
  const frameCount = $derived(
    Math.min(
      MAX_FILMSTRIP_FRAMES,
      Math.max(2, Math.ceil(durationSec * FILMSTRIP_FPS)),
    ),
  )
</script>

<AccentBar icon={IconPlay} label={info.name} />

<div class="body">
  <div class="stats">
    <StatCard value="{durationSec.toFixed(1)}s" label="Duration" />
    <StatCard value={String(FILMSTRIP_FPS)} label="FPS" />
    <StatCard value={String(frameCount)} label="Frames" />
  </div>

  <LabeledToggleable
    id="filmstrip-loop"
    type="checkbox"
    checked={loop}
    label="Loop animation"
    description="Looping animations play seamlessly and don't generate a final frame at the end."
    onchange={({ checked }: { checked: boolean }) => (loop = checked)}
  />

  <LabeledToggleable
    id="filmstrip-outline"
    type="checkbox"
    checked={outlineStrokes}
    label="Outline strokes to filled paths"
    description="Flattens strokes into filled outlines instead of SVG strokes. Try it if the results look off without it."
    onchange={({ checked }: { checked: boolean }) => (outlineStrokes = checked)}
  />

  {#if info.unsupportedNotes.length > 0}
    <div class="notes">
      <p class="tint--type-ui-bold">Heads up</p>
      <ul>
        {#each info.unsupportedNotes as note (note)}
          <li class="tint--type-ui-small">{note}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="spacer"></div>

  <Button variant="primary" onclick={onGenerate} loading={generating}>
    Generate
  </Button>
</div>

<style lang="sass">
.body
  display: flex
  flex-direction: column
  flex: 1
  min-height: 0
  gap: var(--tint-size-16)
  padding: var(--tint-size-16)
  overflow-y: auto

.stats
  display: flex
  gap: var(--tint-size-8)

.notes
  display: flex
  flex-direction: column
  gap: var(--tint-size-4)
  padding: var(--tint-size-8)
  border-radius: var(--tint-size-4)
  background: var(--warning-bg)
  color: var(--warning-color)
  ul
    margin: 0
    padding-inline-start: var(--tint-size-16)

.spacer
  flex: 1
  min-height: 0
</style>
