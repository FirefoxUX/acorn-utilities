<script lang="ts">
  import { TOOL_ORDER, TOOLS } from '@tools/registry'
  import { TOOL_ICONS } from '@ui/tools/registry'
  import { nav } from '@ui/lib/nav'
  import ToolTile from '@ui/components/ToolTile.svelte'
</script>

<div class="menu">
  <header class="menu-header">
    <h1 class="tint--type-title-sans-2">Acorn Utilities</h1>
    <p class="tint--type-ui-small">
      A collection of useful tools from the Acorn team
    </p>
  </header>

  <div class="tool-grid">
    {#each TOOL_ORDER as id (id)}
      <ToolTile
        title={TOOLS[id].title}
        description={TOOLS[id].description}
        icon={TOOL_ICONS[id]}
        accent={TOOLS[id].accent}
        onclick={() => nav.openTool(id)}
      />
    {/each}
  </div>
</div>

<style lang="sass">
.menu
  display: flex
  flex-direction: column
  flex: 1
  min-height: 0
  gap: tint.$size-16
  padding: tint.$size-16
  overflow-y: auto

.menu-header
  display: flex
  flex-direction: column
  gap: tint.$size-2
  p
    color: var(--tint-text-secondary)

.tool-grid
  display: grid
  grid-template-columns: repeat(2, 1fr)
  gap: tint.$size-12
</style>
