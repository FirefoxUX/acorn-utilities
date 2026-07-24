# Acorn Utilities

Acorn Utilities is a Figma plugin for the Acorn design system team. It collects
small in-Figma tools behind one menu. Today it ships two: Prepare Icons, which
cleans up and categorizes selected icon frames, and Generate Filmstrips, which bakes
a Motion animation into a CSS filmstrip.

## Getting started

```sh
npm install
npm run build
```

In the Figma desktop app, open Plugins → Development → Import plugin from manifest and
pick `dist/manifest.json`. While developing, run `npm run watch` to rebuild on save,
then re-run the plugin in Figma to pick up the change.

The plugin uses the `tint` design system for its components, icons, and tokens.
Storybook lives at https://tint.juliana.me and the icon library at
https://tint.juliana.me/?path=/docs/iconography-library--docs.

## Architecture

The code is split into three bundles:

- `src/ui/` is the Svelte 5 interface. It runs in the plugin's iframe, so it has the
  DOM but no direct access to the Figma document.
- `src/code/` is the backend. It runs in the Figma sandbox and is the only place the
  `figma` API is touched. There is no DOM here.
- `src/tools/` holds bundle-neutral contracts (message types, state shapes, tool
  metadata) imported by both sides. It must never import `figma` or a `.svelte` file,
  since it compiles into both bundles.

The two sides talk over a typed message bridge (`src/message-handler.ts`), and the UI
renders from an observable app-state object that the backend mutates.


## Development

- `npm run watch` rebuilds the UI and backend bundles on save.
- `npm run build` produces a clean `dist/`.
- `npm run check` type-checks with svelte-check.
- `npm run lint` runs ESLint and `npm run prettier` formats the source.
- `npm test` runs the unit tests with Vitest.

Shared versus tool-specific. Before writing code, decide whether it belongs to one
tool or to all of them. Cross-tool code lives in `src/tools`, shared backend modules
under `src/code`, or shared components under `src/ui/components`; code only one tool
needs stays in that tool's folder. Revisit the call as a feature grows, since
something that started tool-specific often turns out to be shared.

Check tint first. Before building any UI, look for an existing tint component or icon
instead of making your own. Browse the storybook at https://tint.juliana.me and the
icon library at https://tint.juliana.me/?path=/docs/iconography-library--docs.

## Adding a tool

A tool is a self-contained slice wired through a few registries, all keyed by one
`ToolId`. Start in `src/tools/registry.ts`: add the id to the `ToolId` union and a
`TOOLS` entry with a title, a one-line description, and an accent color as a hex
string (for example `#046000`). Then add the tool's state slice, a backend
`register()` under `src/code/tools/<id>/`, and a Svelte root under
`src/ui/tools/<id>/`, listing each in the matching registry. The registries are
exhaustive `Record<ToolId, …>` maps, so `npm run check` reports exactly what is still
missing until the tool is fully wired, and the menu and router pick up the accent from
the metadata on their own.

## License

Mozilla Public License 2.0. See [LICENSE](./LICENSE).
