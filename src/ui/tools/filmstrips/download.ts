// Download a string as a file from inside the Figma plugin iframe. Uses a blob
// object URL + a programmatic anchor click — works under manifest
// networkAccess:none (no network request, no host file API needed).

export function downloadText(
  contents: string,
  filename: string,
  mime: string,
): void {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadSvg(svg: string, filename: string): void {
  downloadText(svg, filename, 'image/svg+xml')
}
