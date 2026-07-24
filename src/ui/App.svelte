<script lang="ts">
  import { appState } from '@ui/store/state'
  import { errorStore } from '@ui/store/error'
  import Dialog, {
    type DialogOptions,
    type DialogResult,
  } from 'tint/components/Dialog.svelte'
  import Menu from '@ui/views/Menu.svelte'
  import { TOOLS } from '@tools/registry'
  import { TOOL_COMPONENTS } from '@ui/tools/registry'
  import ToolTheme from '@ui/components/ToolTheme.svelte'
  import ResizeHandle from '@ui/components/ResizeHandle.svelte'

  let openErrorDialog:
    | ((options?: DialogOptions) => Promise<DialogResult>)
    | undefined = $state(undefined)

  // Tool router: the active tool is looked up by its `ToolId` in the exhaustive
  // registries — its root from `TOOL_COMPONENTS`, its accent from `TOOLS` — and
  // themed here so a tool never wires its own color. Adding a tool means adding a
  // registry entry, not touching this file. `null` means the main menu.
  const activeTool = $derived($appState.activeTool)
  const ActiveRoot = $derived(activeTool ? TOOL_COMPONENTS[activeTool] : null)
  const activeAccent = $derived(activeTool ? TOOLS[activeTool].accent : '')

  // App-global error dialog: any tool's safeRequest surfaces here.
  $effect(() => {
    if (openErrorDialog) {
      errorStore.setDialogCallback(async (options) => {
        await openErrorDialog?.({
          heading: options.heading,
          children: options.children,
        })
      })
    }
  })
</script>

<main>
  {#if ActiveRoot}
    <!-- Key on the tool id so switching tools remounts the view (and its theme)
         cleanly rather than reusing the previous tool's component instance. -->
    {#key activeTool}
      <ToolTheme accent={activeAccent}>
        <ActiveRoot />
      </ToolTheme>
    {/key}
  {:else}
    <Menu />
  {/if}
</main>

<ResizeHandle />
<Dialog bind:openDialog={openErrorDialog} variant="acknowledge" />

<style lang="sass">
main
  display: flex
  flex-direction: column
  flex: 1
  min-height: 0
</style>
