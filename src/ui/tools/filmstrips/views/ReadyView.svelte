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
    generating,
    onGenerate,
  }: {
    info: SelectionMotionInfo
    outlineStrokes: boolean
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
    id="filmstrip-outline"
    type="checkbox"
    checked={outlineStrokes}
    label="Outline strokes to filled paths"
    description="Off keeps SVG strokes. On flattens strokes into filled outlines. If results look off without, try turning this on."
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
  gap: tint.$size-16
  padding: tint.$size-16
  overflow-y: auto

.stats
  display: flex
  gap: tint.$size-8

.notes
  display: flex
  flex-direction: column
  gap: tint.$size-4
  padding: tint.$size-8
  border-radius: tint.$size-4
  background: var(--warning-bg)
  color: var(--warning-color)
  ul
    margin: 0
    padding-left: tint.$size-16

.spacer
  flex: 1
  min-height: 0
</style>
