// Builds the leading SVG comment for a Firefox-format filmstrip export: a
// short intro plus a minimal, runnable CSS block that plays this exact
// animation. The keyframe schedule follows indicator.css's step model (one
// real frame is one `steps()` step; a pause adds `round(pauseMs / frameStepMs)`
// steps; percentages are cumulative steps over the total). Every value is
// hardcoded. no CSS custom properties. because an SVG/XML comment can't
// contain a double hyphen, which `--custom-props` would introduce.

import { buildSchedule, type PausePoint } from './pause-schedule'

function transformFor(frame: number, cellW: number): string {
  return frame === 0
    ? 'translateX(0)'
    : `translateX(calc(${frame} * -${cellW}px))`
}

function pct(cumSteps: number, animSteps: number): string {
  return `${((cumSteps / animSteps) * 100).toFixed(2)}%`
}

export function computeFirefoxComment(
  frameCount: number,
  durationMs: number,
  cellW: number,
  cellH: number,
  pauses: readonly PausePoint[],
  loop: boolean,
): string {
  const { segments } = buildSchedule(frameCount, durationMs, pauses, loop)
  const frameStepMs = frameCount > 0 ? durationMs / frameCount : 0
  const pauseStepsFor = (ms: number) =>
    Math.max(1, Math.round(ms / frameStepMs))

  const totalPauseSteps = segments.reduce(
    (sum, s) => (s.kind === 'hold' ? sum + pauseStepsFor(s.durationMs) : sum),
    0,
  )
  const animSteps = frameCount + totalPauseSteps
  const animDurationMs = Math.round(animSteps * frameStepMs)
  // A one-shot strip carries one extra resting cell (see renderFilmstrip).
  const stripW = (loop ? frameCount : frameCount + 1) * cellW

  // One keyframe per segment boundary, plus an explicit final frame so the
  // block works standalone (no reliance on a resting transform). The timing
  // function on a keyframe governs the interval that starts at it.
  const keyframes: string[] = []
  let cumSteps = 0
  for (const seg of segments) {
    const label = cumSteps === 0 ? 'from' : pct(cumSteps, animSteps)
    if (seg.kind === 'play') {
      keyframes.push(
        `  ${label} { animation-timing-function: steps(${seg.steps}); transform: ${transformFor(seg.fromFrame, cellW)}; }`,
      )
      cumSteps += seg.steps
    } else {
      keyframes.push(
        `  ${label} { transform: ${transformFor(seg.atFrame, cellW)}; }  /* hold frame ${seg.atFrame} for ${seg.durationMs}ms */`,
      )
      cumSteps += pauseStepsFor(seg.durationMs)
    }
  }
  const last = segments[segments.length - 1]
  const lastFrame = !last
    ? frameCount
    : last.kind === 'play'
      ? last.toFrame
      : last.atFrame
  keyframes.push(`  to { transform: ${transformFor(lastFrame, cellW)}; }`)

  const lines: string[] = [
    `This SVG is a ${frameCount}-frame filmstrip (${cellW}x${cellH}px per frame).`,
    `The CSS below plays it ${loop ? 'on a loop' : 'once and holds the final frame'}. An`,
    'outer element clips to one frame while an inner element slides the strip.',
    'Adjust the selectors and the url.',
    '',
    '.filmstrip {',
    `  width: ${cellW}px;`,
    `  height: ${cellH}px;`,
    '  overflow: hidden;',
    '}',
    '.filmstrip > .strip {',
    `  width: ${stripW}px;  /* ${frameCount} frames */`,
    `  height: ${cellH}px;`,
    '  background: url("filmstrip.svg") no-repeat;',
    `  animation: filmstrip ${animDurationMs}ms ${loop ? 'infinite' : '1 forwards'};`,
    '}',
    '@keyframes filmstrip {',
    ...keyframes,
    '}',
    '',
    'context-fill / context-stroke colors tint from the element: set fill /',
    'stroke on it, with -moz-context-properties: fill, stroke.',
  ]

  return `<!--\n${lines.map((l) => (l ? `  ${l}` : '')).join('\n')}\n-->`
}
