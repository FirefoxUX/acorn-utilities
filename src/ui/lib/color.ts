// Color helpers for deriving UI state colors from a tool's accent. Pure and
// DOM-free so they can be unit-tested and reused anywhere in the UI bundle.

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Parse `#rgb` or `#rrggbb` into 0–255 channels; null for any other form. */
function parseHex(hex: string): [number, number, number] | null {
  const body = hex.trim().replace(/^#/, '')
  if (body.length === 3) {
    return [
      parseInt(body[0] + body[0], 16),
      parseInt(body[1] + body[1], 16),
      parseInt(body[2] + body[2], 16),
    ]
  }
  if (body.length === 6) {
    return [
      parseInt(body.slice(0, 2), 16),
      parseInt(body.slice(2, 4), 16),
      parseInt(body.slice(4, 6), 16),
    ]
  }
  return null
}

function channelToHex(channel: number): string {
  return clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')
}

// h in [0,360), s and l in [0,100].
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6
        break
      case g:
        h = (b - r) / delta + 2
        break
      default:
        h = (r - g) / delta + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s * 100, l * 100]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

/**
 * Darken a hex color by an absolute number of HSL lightness points (0–100),
 * keeping its hue and saturation. This shifts lightness by a fixed amount
 * rather than mixing toward black (as CSS `color-mix` in srgb does), because a
 * proportional mix barely moves a dark color: hover/active states derived from a
 * dark tool accent like `#5B1031` would come out almost identical to the base.
 * Unknown color formats are returned unchanged.
 */
export function darken(hex: string, lightnessPoints: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2])
  const [r, g, b] = hslToRgb(h, s, clamp(l - lightnessPoints, 0, 100))
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`
}
