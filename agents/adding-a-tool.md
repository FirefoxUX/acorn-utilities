# Adding a tool

This walks a contributor through adding a new tool. Many contributors are designers,
so run it as a conversation: gather the inputs one at a time, then do the wiring for
them.

## Intake

Ask for these one at a time, in order. After each question, stop and wait for the
answer. Do not ask the next question, and do not write any code, until the current
one is answered.

1. Tool name. The title on the menu tile and the tool's header, for example "Prepare
   Icons". Settle on a short one-line description too.
2. Accent color. A hex color for the tool, for example `#046000`. It colors the menu
   tile and the tool's buttons.
3. Menu icon. Which tint icon to show on the tile. Point them at the icon library:
   https://tint.juliana.me/?path=/docs/iconography-library--docs
4. tint components. Which existing tint components the tool's UI will use. Point them
   at the storybook: https://tint.juliana.me. Check tint before building any custom
   UI.

Once you have all four, derive a `ToolId` (kebab-case, for example `prepare-icons`)
and do the wiring below.

## Wiring

A tool is one `ToolId` threaded through a few registries. The exhaustive
`Record<ToolId, …>` maps mean the compiler flags every place still missing an entry,
so `npm run check` is your checklist.

1. Metadata, in `src/tools/registry.ts`. Add the id to the `ToolId` union, add a
   `TOOLS` entry (id, title, description, accent), and add the id to `TOOL_ORDER`.
2. State, in `src/tools/<id>/`. Define the tool's state shape and message types. Wire
   the state slice into `AppState` in `src/types.ts` and its defaults in
   `src/defaults.ts`.
3. Backend, in `src/code/tools/<id>/index.ts`. Export a `register(ctx)` that returns
   a `ToolBackend` (see the contract in `src/code/tools/types.ts`), then list it in
   `src/code/tools/registry.ts`.
4. UI, in `src/ui/tools/<id>/`. Add a `<Name>Root.svelte` and a `store.ts`, then
   register the root and its icon in `src/ui/tools/registry.ts`. You do not wire
   theming: the router applies the accent from the metadata.

## Finish

Run `npm run check`, `npm run lint`, and `npm run prettier`, and fix anything they
flag. Then follow the commit rules in `AGENTS.md`: work on a branch, no co-author,
open a pull request.

While building, keep weighing what should be shared versus specific to this tool (see
the README). If a piece looks useful to other tools, put it in the shared layer
instead of the tool's folder.
