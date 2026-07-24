# Writing style

Apply this to everything you write in this repo: code comments, documentation, commit
messages, pull request descriptions, and UI copy. The goal is plain, specific writing
that doesn't read as machine-generated. When in doubt, cut words.

## Tone and content

- Don't announce importance. If something matters, show it with specifics rather than
  calling it "crucial", "pivotal", or "key". Let the reader judge from the substance.
- Don't tack shallow analysis onto the end of a sentence with an -ing phrase
  ("highlighting the importance of", "ensuring a smooth experience"). State the point.
- Skip promotional language: "groundbreaking", "cutting-edge", "seamless",
  "showcasing", "robust". Write it straight.
- Don't attribute claims to vague groups ("experts agree", "many believe"). Name a
  source or state the point without one.
- Don't speculate to cover a gap. If you don't know, find out, say so, or leave it out.

## Vocabulary

- Go easy on: additionally, align with, crucial, delve, emphasize, enhance, foster,
  leverage, meticulous, pivotal, robust, seamless, showcase, streamline, testament,
  underscore, utilize, valuable.
- Prefer simple verbs. "use" not "utilize", "try" not "attempt", "has" not "features"
  or "boasts", "is" not "serves as".

## Sentence structure

- Don't overuse "not just X, but also Y" or "not X, it's Y".
- Don't default to the rule of three ("fast, flexible, and reliable"). A point rarely
  needs two siblings.
- Repeat a term when repeating is clearer. Don't cycle synonyms for one thing: a
  `request` that becomes a "call", then an "invocation", reads as three things.
- Use em dashes sparingly, where a comma or parentheses won't do, and without spaces
  around them.

## Formatting

- Sentence case for headings, not Title Case For Every Word.
- Don't over-bold. If everything is bold, nothing stands out.
- Don't turn prose into a list of bold inline headers followed by descriptions when a
  sentence or a plain list would do.

## Structure

- Don't end with "In summary", "In conclusion", or "Overall". If you've made the
  point, stop.
- Drop didactic disclaimers: "It's important to note", "Keep in mind that". State the
  thing.
- Don't open by defining a term dictionary-style ("X refers to..."). Explain it.
- Skip filler pleasantries ("Great question!", "I hope this helps!").

## Commit messages and pull requests

- Say what changed and why, specifically. "Move the accent color into ToolMeta so the
  router themes each tool from one place" beats "refactor theming for maintainability".
- No AI mention and no `Co-Authored-By` trailer (see `AGENTS.md`).

## UI copy

- Keep strings short and direct, and consistent with the copy already in the tool.
- Match the wording of existing tint components rather than inventing new phrasing.
