// Builds a `<metadata>` block for a Firefox-format filmstrip export: a minimal,
// runnable CSS block that plays this exact animation, modelled on indicator.css.
// It lives in a <metadata> element rather than an XML comment so it can use CSS
// custom properties (`--anim-frames` / `--anim-steps`): element text may contain
// the `--` that an XML comment forbids. The keyframe schedule follows
// indicator.css's step model (one real frame is one `steps()` step; a pause adds
// `round(pauseMs / frameStepMs)` steps; percentages are cumulative steps over the
// total). Frame indices inside @keyframes stay literal (as in indicator.css); only
// the outer counts are custom properties.

import { buildSchedule, type PausePoint } from './pause-schedule'

function transformFor(frame: number, cellW: number): string {
  return frame === 0
    ? 'translateX(0)'
    : `translateX(calc(${frame} * -${cellW}px))`
}

function pct(cumSteps: number, animSteps: number): string {
  return `${((cumSteps / animSteps) * 100).toFixed(2)}%`
}

// Per-frame duration as a short decimal, e.g. 16.667 for 60fps. Trailing zeros
// are trimmed (String(Number(...))) so a whole number reads as "16", not "16.000".
function stepMs(frameStepMs: number): string {
  return String(Number(frameStepMs.toFixed(3)))
}

export function computeFirefoxMetadata(
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

  // One keyframe per segment boundary. The timing function on a keyframe governs
  // the interval that starts at it. A loop closes with an explicit wrap keyframe;
  // a one-shot omits it and rests on the element's end transform (like the
  // indicator.css finish animation), held by `forwards`.
  const keyframes: string[] = []
  let cumSteps = 0
  for (const seg of segments) {
    const label = cumSteps === 0 ? 'from' : pct(cumSteps, animSteps)
    if (seg.kind === 'play') {
      keyframes.push(
        `    ${label} { animation-timing-function: steps(${seg.steps}); transform: ${transformFor(seg.fromFrame, cellW)}; }`,
      )
      cumSteps += seg.steps
    } else {
      keyframes.push(
        `    ${label} { transform: ${transformFor(seg.atFrame, cellW)}; }  /* hold frame ${seg.atFrame} for ${seg.durationMs}ms */`,
      )
      cumSteps += pauseStepsFor(seg.durationMs)
    }
  }
  if (loop) {
    keyframes.push(
      `    to { transform: translateX(calc(var(--anim-frames) * -${cellW}px)); }`,
    )
  }

  // Loop rests at frame 0 (the wrap keyframe drives it); a one-shot rests on the
  // extra final cell at index anim-frames.
  const restTransform = loop
    ? 'translateX(0)'
    : `translateX(calc(var(--anim-frames) * -${cellW}px))`
  const stepsComment = totalPauseSteps
    ? `  /* ${frameCount} frames + ${totalPauseSteps} pause */`
    : ''

  const lines: string[] = [
    `  /* Firefox filmstrip: ${frameCount} frames, ${cellW}x${cellH}px each.`,
    `     An outer element clips to one frame; the inner .strip slides it.`,
    `     ${loop ? 'Loops seamlessly.' : 'Plays once and holds the final frame.'} Adjust the selectors and the url. */`,
    `  .filmstrip {`,
    `    width: ${cellW}px;`,
    `    height: ${cellH}px;`,
    `    overflow: hidden;`,
    `  }`,
    `  .filmstrip > .strip {`,
    `    --anim-frames: ${frameCount};`,
    `    --anim-steps: ${animSteps};${stepsComment}`,
    `    width: calc(${cellW}px * (var(--anim-frames)${loop ? '' : ' + 1'}));`,
    `    height: ${cellH}px;`,
    `    background: url("filmstrip.svg") no-repeat;`,
    `    animation: filmstrip calc(var(--anim-steps) * ${stepMs(frameStepMs)}ms) ${loop ? 'infinite' : 'forwards'};`,
    `    transform: ${restTransform};`,
    `  }`,
    `  @keyframes filmstrip {`,
    ...keyframes,
    `  }`,
    ``,
    `  /* context-fill / context-stroke colors tint from the element: set fill /`,
    `     stroke on it, with -moz-context-properties: fill, stroke. */`,
  ]

  return `<metadata>\n${lines.join('\n')}\n</metadata>`
}
