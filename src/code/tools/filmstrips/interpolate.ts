// Pure sampling + interpolation engine: turn a node's Motion keyframes into a
// discrete list of poses. No `figma` mutation (only ambient RGBA/Vector types),
// so this is unit-testable in isolation.

import { evalEasing, isSpringEasing } from './easing'
import type {
  Animations,
  KeyframeBinding,
  KeyframeValue,
  ManualKeyframe,
  MotionEasingOrAlias,
} from './motion-types'

// Whether a keyframe's easing governs the segment ENDING at it ('end') or
// STARTING from it ('start'). Figma attaches easing to the arriving keyframe.
// Flip this single constant if empirical testing shows otherwise.
const EASING_ON: 'start' | 'end' = 'end'

// Normalized numeric properties we can bake onto a Figma node.
export type NumericField =
  | 'translateX'
  | 'translateY'
  | 'rotation'
  | 'scaleX'
  | 'scaleY'
  | 'opacity'
  | 'width'
  | 'height'
  | 'cornerRadius'
  | 'trimStart'
  | 'trimEnd'
  | 'trimOffset'

interface ScalarKey {
  time: number // seconds
  value: number
  easing: MotionEasingOrAlias | undefined
}

interface ColorKey {
  time: number
  value: RGBA
  easing: MotionEasingOrAlias | undefined
}

export interface NodeTracks {
  numeric: Partial<Record<NumericField, ScalarKey[]>>
  fills: Map<number, ColorKey[]>
  strokes: Map<number, ColorKey[]>
  unsupportedNotes: string[]
}

/** A resolved node state at a single sample time. Absent fields = leave as authored. */
export interface Pose {
  translateX?: number
  translateY?: number
  rotation?: number // degrees
  scaleX?: number
  scaleY?: number
  opacity?: number
  width?: number
  height?: number
  cornerRadius?: number
  /** Path-trim fractions in 0..1, baked by the SVG engine's trim step. */
  trimStart?: number
  trimEnd?: number
  trimOffset?: number
  fills: { index: number; color: RGBA }[]
  strokes: { index: number; color: RGBA }[]
}

// ---------------------------------------------------------------------------
// Reading keyframes
// ---------------------------------------------------------------------------

function floatOf(v: KeyframeValue): number | null {
  return v.type === 'FLOAT' ? v.value : null
}

function vectorOf(v: KeyframeValue): Vector | null {
  return v.type === 'VECTOR' ? v.value : null
}

function colorOf(v: KeyframeValue): RGBA | null {
  return v.type === 'COLOR' ? v.value : null
}

/** Gather SET-operation keyframes from a binding, sorted by time. */
function setKeyframes(
  binding: KeyframeBinding,
  onNonSet: () => void,
): ManualKeyframe[] {
  const out: ManualKeyframe[] = []
  for (const track of binding.tracks) {
    if (track.keyframeOperation !== 'SET') {
      onNonSet()
      continue
    }
    out.push(...track.keyframes)
  }
  out.sort((a, b) => a.timelinePosition - b.timelinePosition)
  return out
}

function toScalarKeys(
  kfs: ManualKeyframe[],
  pick: (v: KeyframeValue) => number | null,
): ScalarKey[] {
  const keys: ScalarKey[] = []
  for (const kf of kfs) {
    const value = pick(kf.value)
    if (value === null) continue
    keys.push({ time: kf.timelinePosition, value, easing: kf.easing })
  }
  return keys
}

/** Read a node's merged animations into normalized numeric + color tracks. */
export function readTracks(anims: Animations): NodeTracks {
  const numeric: Partial<Record<NumericField, ScalarKey[]>> = {}
  const fills = new Map<number, ColorKey[]>()
  const strokes = new Map<number, ColorKey[]>()
  const notes = new Set<string>()

  let hasSpring = false
  const markNonSet = () =>
    notes.add('Some keyframes use offset/scale tracks. baked as absolute.')

  const scalar = (field: NumericField, binding: KeyframeBinding) => {
    const kfs = setKeyframes(binding, markNonSet)
    if (kfs.some((k) => isSpringEasing(k.easing))) hasSpring = true
    const keys = toScalarKeys(kfs, floatOf)
    if (keys.length) numeric[field] = keys
  }

  const vectorPair = (
    fx: NumericField,
    fy: NumericField,
    binding: KeyframeBinding,
  ) => {
    const kfs = setKeyframes(binding, markNonSet)
    if (kfs.some((k) => isSpringEasing(k.easing))) hasSpring = true
    const xs: ScalarKey[] = []
    const ys: ScalarKey[] = []
    for (const kf of kfs) {
      const v = vectorOf(kf.value)
      if (!v) continue
      xs.push({ time: kf.timelinePosition, value: v.x, easing: kf.easing })
      ys.push({ time: kf.timelinePosition, value: v.y, easing: kf.easing })
    }
    if (xs.length) numeric[fx] = xs
    if (ys.length) numeric[fy] = ys
  }

  for (const [field, binding] of Object.entries(anims)) {
    if (
      !binding ||
      field === 'fills' ||
      field === 'strokes' ||
      field === 'effects'
    ) {
      continue
    }
    const b = binding as KeyframeBinding
    switch (field) {
      case 'TRANSLATION_X':
        scalar('translateX', b)
        break
      case 'TRANSLATION_Y':
        scalar('translateY', b)
        break
      case 'TRANSLATION_XY':
        vectorPair('translateX', 'translateY', b)
        break
      case 'ROTATION':
        scalar('rotation', b)
        break
      case 'SCALE_X':
        scalar('scaleX', b)
        break
      case 'SCALE_Y':
        scalar('scaleY', b)
        break
      case 'SCALE_XY':
        vectorPair('scaleX', 'scaleY', b)
        break
      case 'OPACITY':
        scalar('opacity', b)
        break
      case 'WIDTH':
        scalar('width', b)
        break
      case 'HEIGHT':
        scalar('height', b)
        break
      case 'CORNER_RADIUS':
        scalar('cornerRadius', b)
        break
      case 'PATH_TRIM_START':
        scalar('trimStart', b)
        break
      case 'PATH_TRIM_END':
        scalar('trimEnd', b)
        break
      case 'PATH_TRIM_OFFSET':
        scalar('trimOffset', b)
        break
      default:
        notes.add(`Unsupported animated property "${field}" was skipped.`)
    }
  }

  const readPaintMap = (
    src: Partial<Record<number, KeyframeBinding>> | undefined,
    dest: Map<number, ColorKey[]>,
  ) => {
    if (!src) return
    for (const [idx, binding] of Object.entries(src)) {
      if (!binding) continue
      const kfs = setKeyframes(binding, markNonSet)
      if (kfs.some((k) => isSpringEasing(k.easing))) hasSpring = true
      const keys: ColorKey[] = []
      for (const kf of kfs) {
        const c = colorOf(kf.value)
        if (!c) continue
        keys.push({ time: kf.timelinePosition, value: c, easing: kf.easing })
      }
      if (keys.length) dest.set(Number(idx), keys)
    }
  }
  readPaintMap(anims.fills, fills)
  readPaintMap(anims.strokes, strokes)

  if (anims.effects && Object.keys(anims.effects).length > 0) {
    notes.add('Effect (blur/shadow) animations are not baked.')
  }
  if (hasSpring) {
    notes.add('Spring easings are approximated.')
  }

  return { numeric, fills, strokes, unsupportedNotes: [...notes] }
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p
}

/** Interpolate a sorted scalar track at time t (seconds). */
function sampleScalar(keys: ScalarKey[], t: number): number {
  if (keys.length === 1 || t <= keys[0].time) return keys[0].value
  const last = keys[keys.length - 1]
  if (t >= last.time) return last.value

  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i]
    const k1 = keys[i + 1]
    if (t >= k0.time && t < k1.time) {
      const span = k1.time - k0.time
      const localT = span > 0 ? (t - k0.time) / span : 0
      const easing = EASING_ON === 'end' ? k1.easing : k0.easing
      return lerp(k0.value, k1.value, evalEasing(easing, localT))
    }
  }
  return last.value
}

function sampleColor(keys: ColorKey[], t: number): RGBA {
  if (keys.length === 1 || t <= keys[0].time) return keys[0].value
  const last = keys[keys.length - 1]
  if (t >= last.time) return last.value

  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i]
    const k1 = keys[i + 1]
    if (t >= k0.time && t < k1.time) {
      const span = k1.time - k0.time
      const localT = span > 0 ? (t - k0.time) / span : 0
      const p = evalEasing(EASING_ON === 'end' ? k1.easing : k0.easing, localT)
      return {
        r: lerp(k0.value.r, k1.value.r, p),
        g: lerp(k0.value.g, k1.value.g, p),
        b: lerp(k0.value.b, k1.value.b, p),
        a: lerp(k0.value.a, k1.value.a, p),
      }
    }
  }
  return last.value
}

/** Build the pose at time t (seconds). */
export function buildPose(tracks: NodeTracks, t: number): Pose {
  const pose: Pose = { fills: [], strokes: [] }
  for (const [field, keys] of Object.entries(tracks.numeric)) {
    if (keys && keys.length) {
      pose[field as NumericField] = sampleScalar(keys, t)
    }
  }
  for (const [index, keys] of tracks.fills) {
    pose.fills.push({ index, color: sampleColor(keys, t) })
  }
  for (const [index, keys] of tracks.strokes) {
    pose.strokes.push({ index, color: sampleColor(keys, t) })
  }
  return pose
}

/**
 * Build N poses sampled at t_i = (i/N)*duration for i in [0, N-1].
 * Sampling at i/N (start-of-step) pairs with CSS steps(N, start) +
 * translateX(-100%) for a seamless loop with no duplicate/blank frame.
 */
export function buildPoses(
  tracks: NodeTracks,
  durationSec: number,
  n: number,
): Pose[] {
  const poses: Pose[] = []
  for (let i = 0; i < n; i++) {
    poses.push(buildPose(tracks, (i / n) * durationSec))
  }
  return poses
}
