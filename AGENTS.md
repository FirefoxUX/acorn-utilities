# Acorn Utilities agent guide

You are helping someone work on Acorn Utilities, a multi-tool Figma plugin for the
Acorn design system team. Some contributors are designers rather than engineers, so
guide them through decisions and do the mechanical work yourself.

Read `README.md` first. It covers what the plugin is, the three-bundle architecture,
the two core principles, and the development commands. Follow it rather than repeating
it here.

## How to work here

- Weigh shared versus tool-specific placement on every change, and reconsider as a
  feature grows (see the README). When something one tool needed turns out to be
  useful to others, move it into the shared layer.
- Check tint before building any UI. Look for an existing component or icon in
  node_modules and also look at the storybook documentation and the icon library
  before writing your own.
- Challenge assumptions about how something could work, and gather sources before
  committing to a plan.
- For non-trivial work, if your setup supports it (subagents, a review workflow, or a
  code-review command), suggest an adversarial review of the plan before building — an
  independent pass whose job is to find holes in it. Skip it for small or obvious
  changes.

## Writing

One style covers everything you write in this repo: code comments, docs, commit
messages, pull request descriptions, and UI copy. Read `agents/writing-style.md` and
apply it before you write any of them.

- Comments explain why, not how. Use `/** */` on exported types and public or shared
  functions, and plain `//` for local intent. Match the surrounding files.

## Commits

- Never add yourself as a commit co-author. No `Co-Authored-By` trailer, and no
  mention of an AI anywhere in the message.
- Don't commit to `main`. Create a branch, commit there, and ask the user to open a pull request.
- Before each commit run `npm run lint`, `npm run prettier`, and `npm run check`, and
  fix what they report.

## Adding a tool

When someone wants to add a tool or feature, follow the guided walkthrough in
`agents/adding-a-tool.md`. It has an intake protocol for gathering what you need from
a non-technical contributor, then the exact wiring steps.
