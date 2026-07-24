// Local declarations of the Figma Motion API (BETA). The installed
// @figma/plugin-typings (v1.123) does not yet ship these, so we mirror the
// public docs (https://developers.figma.com/docs/plugins/api/Motion/) for the
// subset we read, and access the node properties through typed accessors that
// cast — keeping the `figma`-global untyped elsewhere.

export type MotionEasingType =
  | 'EASE_IN'
  | 'EASE_OUT'
  | 'EASE_IN_AND_OUT'
  | 'LINEAR'
  | 'EASE_IN_BACK'
  | 'EASE_OUT_BACK'
  | 'EASE_IN_AND_OUT_BACK'
  | 'CUSTOM_CUBIC_BEZIER'
  | 'GENTLE'
  | 'QUICK'
  | 'BOUNCY'
  | 'SLOW'
  | 'CUSTOM_SPRING'
  | 'HOLD'

export interface EasingFunctionBezier {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface NormalizedSpring {
  bounce: number
}

export interface MotionEasing {
  type: MotionEasingType
  easingFunctionCubicBezier?: EasingFunctionBezier
  easingFunctionSpring?: NormalizedSpring
}

// A VariableAlias-bound easing has no `type` field; we treat it as linear.
export type MotionEasingOrAlias = MotionEasing | { type?: undefined }

export type KeyframeValue =
  | { type: 'FLOAT'; value: number }
  | { type: 'COLOR'; value: RGBA }
  | { type: 'TEXT_DATA'; value: string }
  | { type: 'VECTOR'; value: Vector }
  | { type: 'BOOL'; value: boolean }
  | { type: 'CIRCLE'; value: { x: number; y: number; radius: number } }
  | { type: 'LINE'; value: { x: number; y: number; x2: number; y2: number } }
  | {
      type: 'CIRCLE_POINT'
      value: { x: number; y: number; radius: number; angle: number }
    }
  | { type: 'COLOR_POINT'; value: { x: number; y: number; color: RGBA } }

export interface ManualKeyframe {
  id: string
  timelinePosition: number // seconds
  easing: MotionEasingOrAlias
  value: KeyframeValue
}

export type KeyframeOperation = 'SET' | 'OFFSET' | 'SCALE'

export interface ManualKeyframeTrack {
  id: string
  keyframeOperation: KeyframeOperation
  keyframes: ReadonlyArray<ManualKeyframe>
}

export interface KeyframeBinding {
  baseValue: KeyframeValue
  timelineDuration: number // seconds
  tracks: ReadonlyArray<ManualKeyframeTrack>
}

export type KeyframePropertyFieldName =
  | 'CORNER_RADIUS'
  | 'STROKE_WEIGHT'
  | 'WIDTH'
  | 'HEIGHT'
  | 'OPACITY'
  | 'TRANSLATION_X'
  | 'TRANSLATION_Y'
  | 'TRANSLATION_XY'
  | 'ROTATION'
  | 'SCALE_X'
  | 'SCALE_Y'
  | 'SCALE_XY'
  | 'PATH_TRIM_START'
  | 'PATH_TRIM_END'
  // (other stack/grid/border fields exist but are out of scope for v1)
  | string

export type Animations = Partial<
  Record<KeyframePropertyFieldName, KeyframeBinding>
> & {
  fills?: Partial<Record<number, KeyframeBinding>>
  strokes?: Partial<Record<number, KeyframeBinding>>
  effects?: Partial<Record<number, unknown>>
}

export interface Timeline {
  id: string
  duration: number // seconds
}

// A node that may carry Motion data. Used via the accessors below.
interface MotionNode {
  animations?: Animations
  timelines?: ReadonlyArray<Timeline>
}

/** Read a node's merged Motion keyframes, or null if it has none. */
export function getAnimations(node: SceneNode): Animations | null {
  const anims = (node as unknown as MotionNode).animations
  if (!anims) return null
  // An empty object means no animation.
  return Object.keys(anims).length > 0 ? anims : null
}

/** Read the timelines a node belongs to (empty array if unsupported). */
export function getTimelines(node: SceneNode): ReadonlyArray<Timeline> {
  return (node as unknown as MotionNode).timelines ?? []
}
