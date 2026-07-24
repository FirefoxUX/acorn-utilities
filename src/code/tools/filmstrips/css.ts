// Builds the drop-in CSS snippet for a generated filmstrip. A clipped viewport
// masks a wide strip; steps(N, start) + translateX(-100%) walks one cell per
// step and loops seamlessly (pairs with the i/N sampling in interpolate.ts).

export function buildCss(params: {
  cellW: number
  cellH: number
  frameCount: number
  durationMs: number
  filename?: string
}): string {
  const { cellW, cellH, frameCount, durationMs } = params
  const stripW = cellW * frameCount
  const file = params.filename ?? 'filmstrip.svg'
  return `.filmstrip {
  width: ${cellW}px;
  height: ${cellH}px;
  overflow: hidden;
}
.filmstrip__strip {
  width: ${stripW}px;
  height: ${cellH}px;
  background-image: url("${file}");
  background-repeat: no-repeat;
  background-size: ${stripW}px ${cellH}px;
  animation: filmstrip-play ${durationMs}ms steps(${frameCount}, start) infinite;
}
@keyframes filmstrip-play {
  to { transform: translateX(-100%); }
}`
}
