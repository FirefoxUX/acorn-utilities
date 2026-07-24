<script lang="ts">
  import ProgressBar from 'tint/components/ProgressBar.svelte'
  import { iconPrepState as pluginState } from '@ui/tools/icon-prep/store'
</script>

<div class="progress-section">
  <p class="tint--type-ui-bold">
    Processing icon {$pluginState.currentIndex} of {$pluginState.totalCount}
  </p>
  <div class="icon-name">
    <p class="tint--type-ui-small">{$pluginState.currentIconName}</p>
  </div>
  <ProgressBar progress={$pluginState.progress} active showProgress />
</div>

<style lang="sass">
.progress-section
  display: flex
  flex-direction: column
  gap: tint.$size-8
  padding: tint.$size-16

.icon-name
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap
</style>
