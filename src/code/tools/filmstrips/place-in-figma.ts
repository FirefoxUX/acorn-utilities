// Places an already-generated/imported filmstrip SVG onto the canvas as its
// own frame, below the original selection if one is still present.

export function placeFilmstripInFigma(svg: string, name: string): void {
  const placed = figma.createNodeFromSvg(svg)
  placed.name = `${name}-filmstrip`

  const source = figma.currentPage.selection[0]
  const bb = source?.absoluteBoundingBox
  if (bb) {
    placed.x = bb.x
    placed.y = bb.y + bb.height + 100
  }

  figma.currentPage.appendChild(placed)
  figma.currentPage.selection = [placed]
  figma.viewport.scrollAndZoomIntoView([placed])
}
