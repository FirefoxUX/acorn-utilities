<script lang="ts">
  import SelectionScreen from '@ui/components/SelectionScreen.svelte'
  import Button from 'tint/components/Button.svelte'
  import { rawSelectionCount } from '@ui/store/selection'
  import illustration from '../assets/illustration.svg?raw'

  let { onImportStrip }: { onImportStrip: () => void } = $props()
</script>

<SelectionScreen
  {illustration}
  tagline="This tool bakes your animation into an SVG filmstrip, that can be used in Firefox."
>
  {#snippet description()}
    Select a single frame that has a Figma Motion animation applied or click
    import strip if you have an existing filmstrip.
  {/snippet}
  {#snippet lowerAction()}
    <Button
      variant="secondary"
      small
      onclick={onImportStrip}
      disabled={$rawSelectionCount !== 1}
    >
      Import strip
    </Button>
  {/snippet}
</SelectionScreen>
