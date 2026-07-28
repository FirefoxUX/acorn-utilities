// Golden regression guard for the SVG node-model refactor. Snapshots the exact
// renderFilmstrip output on a spread of scenes that exercise the whole serializer
// surface: solid + gradient fills, fill-opacity, clip and alpha masks, plain and
// outlined strokes, nested transforms/opacity, and multi-frame tiling (per-frame
// def id prefixing). Captured on the pre-refactor engine; after the refactor any
// diff must be reviewed as a spec-valid improvement before the snapshot is updated.

import { describe, it, expect } from 'vitest'
import { renderFilmstrip } from '../src/code/tools/filmstrips/render-filmstrip'
import type { RenderOptions } from '../src/code/tools/filmstrips/render-frame'
import { readTracks } from '../src/code/tools/filmstrips/interpolate'
import type { Animations } from '../src/code/tools/filmstrips/motion-types'
import { parsePath } from '../src/code/tools/filmstrips/svg/path-data'
import {
  identity,
  translate,
  fromFigmaTransform,
} from '../src/code/tools/filmstrips/svg/matrix'
import type {
  SceneModel,
  SceneNodeModel,
  Paint,
} from '../src/code/tools/filmstrips/build-scene'

const STROKE_OPTS: RenderOptions = { strokeOutput: 'stroke', colorMapping: null }
const OUTLINE_OPTS: RenderOptions = { strokeOutput: 'outline', colorMapping: null }

const SQUARE = parsePath('M0 0 L10 0 L10 10 L0 10 Z')
const DIAGONAL = parsePath('M0 0 L10 10')

function solid(r: number, g: number, b: number, a = 1): Paint {
  return { kind: 'solid', color: { r, g, b, a } }
}

const IDENTITY_GRADIENT = fromFigmaTransform([
  [1, 0, 0],
  [0, 1, 0],
])

function leaf(overrides: Partial<SceneNodeModel> = {}): SceneNodeModel {
  return {
    type: 'VECTOR',
    isLeaf: true,
    restingMatrix: identity(),
    width: 10,
    height: 10,
    baseOpacity: 1,
    visible: true,
    isMask: false,
    clipsContent: false,
    children: [],
    geometry: { fillSubpaths: SQUARE, centerlineSubpaths: [] },
    style: {
      fills: [solid(1, 0, 0)],
      strokes: [],
      strokeWidth: 0,
      strokeCap: 'butt',
      strokeJoin: 'miter',
      strokeMiterLimit: 4,
      fillRule: 'nonzero',
    },
    hasTrim: false,
    ...overrides,
  }
}

function container(
  children: SceneNodeModel[],
  overrides: Partial<SceneNodeModel> = {},
): SceneNodeModel {
  return {
    type: 'GROUP',
    isLeaf: false,
    restingMatrix: identity(),
    width: 20,
    height: 20,
    baseOpacity: 1,
    visible: true,
    isMask: false,
    clipsContent: false,
    children,
    hasTrim: false,
    ...overrides,
  }
}

function scene(
  children: SceneNodeModel[],
  root?: Partial<SceneNodeModel>,
): SceneModel {
  return { root: container(children, root), width: 20, height: 20 }
}

function strokeLeaf(overrides: Partial<SceneNodeModel> = {}): SceneNodeModel {
  return leaf({
    geometry: { fillSubpaths: [], centerlineSubpaths: DIAGONAL },
    style: {
      fills: [],
      strokes: [solid(0, 0, 0)],
      strokeWidth: 2,
      strokeCap: 'round',
      strokeJoin: 'round',
      strokeMiterLimit: 4,
      fillRule: 'nonzero',
    },
    ...overrides,
  })
}

function gradientLeaf(gradientType: 'linear' | 'radial'): SceneNodeModel {
  const grad: Paint = {
    kind: 'gradient',
    gradientType,
    stops: [
      { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 0, g: 0, b: 1, a: 0.5 } },
    ],
    transform: IDENTITY_GRADIENT,
    opacity: 1,
  }
  return leaf({
    style: {
      fills: [grad],
      strokes: [],
      strokeWidth: 0,
      strokeCap: 'butt',
      strokeJoin: 'miter',
      strokeMiterLimit: 4,
      fillRule: 'nonzero',
    },
  })
}

describe('filmstrip golden output', () => {
  it('solid fill, single frame', () => {
    const svg = renderFilmstrip(scene([leaf()]), 1, 1, 20, 20, STROKE_OPTS, true)
    expect(svg).toMatchSnapshot()
  })

  it('translucent fill across three frames (tiling + per-frame def ids)', () => {
    const s = scene([leaf({ style: { ...leaf().style!, fills: [solid(1, 0, 0, 0.5)] } })])
    const svg = renderFilmstrip(s, 1, 3, 20, 20, STROKE_OPTS, true)
    expect(svg).toMatchSnapshot()
  })

  it('linear gradient fill', () => {
    const svg = renderFilmstrip(scene([gradientLeaf('linear')]), 1, 1, 20, 20, STROKE_OPTS, true)
    expect(svg).toMatchSnapshot()
  })

  it('radial gradient fill', () => {
    const svg = renderFilmstrip(scene([gradientLeaf('radial')]), 1, 1, 20, 20, STROKE_OPTS, true)
    expect(svg).toMatchSnapshot()
  })

  it('solid-opaque clip mask', () => {
    const mask = leaf({ isMask: true, style: { ...leaf().style!, fills: [solid(0, 0, 0)] } })
    const content = leaf({ style: { ...leaf().style!, fills: [solid(0, 0, 1)] } })
    const svg = renderFilmstrip(scene([mask, content]), 1, 1, 20, 20, STROKE_OPTS, true)
    expect(svg).toMatchSnapshot()
  })

  it('soft alpha mask (group)', () => {
    const inner = leaf({ style: { ...leaf().style!, fills: [solid(1, 1, 1)] } })
    const softMask = container([inner], { isMask: true })
    const content = leaf({ style: { ...leaf().style!, fills: [solid(0, 0, 1)] } })
    const svg = renderFilmstrip(scene([softMask, content]), 1, 1, 20, 20, STROKE_OPTS, true)
    expect(svg).toMatchSnapshot()
  })

  it('plain stroke', () => {
    const svg = renderFilmstrip(scene([strokeLeaf()]), 1, 1, 20, 20, STROKE_OPTS, true)
    expect(svg).toMatchSnapshot()
  })

  it('outlined stroke', () => {
    const svg = renderFilmstrip(scene([strokeLeaf()]), 1, 1, 20, 20, OUTLINE_OPTS, true)
    expect(svg).toMatchSnapshot()
  })

  it('clipping frame', () => {
    const inner = leaf({ restingMatrix: translate(15, 0) })
    const frame = container([inner], {
      type: 'FRAME',
      clipsContent: true,
      width: 20,
      height: 20,
    })
    const svg = renderFilmstrip(scene([frame]), 1, 1, 20, 20, STROKE_OPTS, true)
    expect(svg).toMatchSnapshot()
  })

  it('nested clipping frames', () => {
    const inner = container([leaf({ restingMatrix: translate(6, 0) })], {
      type: 'FRAME',
      clipsContent: true,
      restingMatrix: translate(4, 0),
      width: 12,
      height: 12,
    })
    const outer = container([inner], {
      type: 'FRAME',
      clipsContent: true,
      width: 20,
      height: 20,
    })
    const svg = renderFilmstrip(scene([outer]), 1, 1, 20, 20, STROKE_OPTS, true)
    expect(svg).toMatchSnapshot()
  })

  it('nested transform and container opacity', () => {
    const inner = leaf({ restingMatrix: translate(5, 0) })
    const svg = renderFilmstrip(
      scene([inner], { baseOpacity: 0.5 }),
      1,
      1,
      20,
      20,
      STROKE_OPTS,
      true,
    )
    expect(svg).toMatchSnapshot()
  })

  it('one-shot appends a resting cell at t=duration', () => {
    // A fade-in that rests at opacity 0: with loop=false the strip has N+1 cells
    // (frames 0..N-1 plus the true final state at t=duration) and width (N+1)·cellW.
    const fadeIn: Animations = {
      OPACITY: {
        baseValue: { type: 'FLOAT', value: 0 },
        timelineDuration: 1,
        tracks: [
          {
            id: 't',
            keyframeOperation: 'SET',
            keyframes: [
              { id: 'a', timelinePosition: 0, easing: { type: 'LINEAR' }, value: { type: 'FLOAT', value: 0 } },
              { id: 'b', timelinePosition: 1, easing: { type: 'LINEAR' }, value: { type: 'FLOAT', value: 1 } },
            ],
          },
        ],
      },
    }
    const fading = leaf({ baseOpacity: 0, tracks: readTracks(fadeIn) })
    const svg = renderFilmstrip(scene([fading]), 1, 2, 20, 20, STROKE_OPTS, false)
    expect(svg).toMatchSnapshot()
  })
})
