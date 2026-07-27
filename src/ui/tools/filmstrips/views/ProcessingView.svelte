<script lang="ts">
  import ProgressBar from 'tint/components/ProgressBar.svelte'
  import { filmstripsState } from '@ui/tools/filmstrips/store'
</script>

<div class="progress-section">
  <p class="tint--type-ui-bold">
    Baking frame {$filmstripsState.currentFrame} of {$filmstripsState.totalFrames}
  </p>
  <ProgressBar progress={$filmstripsState.progress} active showProgress />
</div>

<style lang="sass">
.progress-section
  display: flex
  flex-direction: column
  gap: var(--tint-size-8)
  padding: var(--tint-size-16)
</style>
