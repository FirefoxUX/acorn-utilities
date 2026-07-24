export type FrameName = {
  category: string // raw category segment (e.g., "arrows & chevrons")
  iconName: string // full icon name with size (e.g., "arrow-clockwise-16")
}

/** Parse a raw frame name into category + icon name segments. Returns null if no `/` separator. */
export function parseFrameName(name: string): FrameName | null {
  const slashIndex = name.indexOf('/')
  if (slashIndex === -1) return null
  return {
    category: name.slice(0, slashIndex).trim(),
    iconName: name.slice(slashIndex + 1).trim(),
  }
}

/** Serialize a FrameName back to the standard format. */
export function serializeFrameName(parsed: FrameName): string {
  return `${parsed.category} / ${parsed.iconName}`
}

/** Kebab-case a string: trim, lowercase, replace non-alphanumeric runs with hyphens, strip leading/trailing hyphens. */
export function toKebabCase(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Strip trailing size suffix (e.g., "-16", "-24") from an icon name. */
export function stripSize(iconName: string): string {
  return iconName.replace(/-\d+$/, '')
}

/** Detect the `-duotone-<size>` suffix the acorn-icons CI keys off of. */
export function isDuotoneName(iconName: string): boolean {
  return /-duotone-\d+$/.test(iconName)
}
