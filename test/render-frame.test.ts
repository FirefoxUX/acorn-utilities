import { describe, it, expect } from 'vitest'
import { renderFrame, type RenderOptions } from '../src/code/tools/filmstrips/render-frame'
import { serialize } from '../src/code/tools/filmstrips/svg/serialize'
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

const OPTS: RenderOptions = { strokeOutput: 'stroke', colorMapping: null }
const SQUARE = parsePath('M0 0 L10 0 L10 10 L0 10 Z')

// renderFrame now returns a node tree; serialize it so the assertions can stay
// on the exact markup they always pinned.
function render(...args: Parameters<typeof renderFrame>) {
  const { nodes, defs } = renderFrame(...args)
  return { nodes, defsNodes: defs, markup: serialize(nodes), defs: serialize(defs) }
}

function solid(r: number, g: number, b: number, a = 1): Paint {
  return { kind: 'solid', color: { r, g, b, a } }
}

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
    children,
    hasTrim: false,
    ...overrides,
  }
}

function scene(children: SceneNodeModel[]): SceneModel {
  return { root: container(children), width: 20, height: 20 }
}

describe('gradient fills', () => {
  it('emits a linearGradient def and a url() fill', () => {
    const grad: Paint = {
      kind: 'gradient',
      gradientType: 'linear',
      stops: [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } },
      ],
      transform: fromFigmaTransform([
        [1, 0, 0],
        [0, 1, 0],
      ]),
      opacity: 1,
    }
    const g = leaf({
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
    const { markup, defs } = render(scene([g]), 0, 0, OPTS)
    expect(markup).toContain('fill="url(#f0_0)"')
    // No fill-opacity: gradient alpha lives in the stops.
    expect(markup).not.toContain('fill-opacity')
    expect(defs).toContain('<linearGradient id="f0_0"')
    expect(defs).toContain('x2="10"') // identity handle spans the 10px-wide box
  })

  it('folds paint opacity into each stop-opacity', () => {
    const grad: Paint = {
      kind: 'gradient',
      gradientType: 'linear',
      stops: [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 0.4 } },
        { position: 1, color: { r: 1, g: 0, b: 0, a: 1 } },
      ],
      transform: fromFigmaTransform([
        [1, 0, 0],
        [0, 1, 0],
      ]),
      opacity: 0.5,
    }
    const g = leaf({
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
    const { defs } = render(scene([g]), 0, 0, OPTS)
    expect(defs).toContain('stop-opacity="0.2"') // 0.4 * 0.5
    expect(defs).toContain('stop-opacity="0.5"') // 1 * 0.5
  })

  it('prefixes def ids with the frame index', () => {
    const grad: Paint = {
      kind: 'gradient',
      gradientType: 'radial',
      stops: [{ position: 0, color: { r: 1, g: 1, b: 1, a: 1 } }],
      transform: fromFigmaTransform([
        [1, 0, 0],
        [0, 1, 0],
      ]),
      opacity: 1,
    }
    const g = leaf({
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
    const { markup, defs } = render(scene([g]), 7, 7, OPTS)
    expect(markup).toContain('url(#f7_0)')
    expect(defs).toContain('<radialGradient id="f7_0"')
  })
})

describe('masks', () => {
  it('emits a clipPath for a solid-opaque mask and does not draw it', () => {
    const mask = leaf({
      isMask: true,
      style: {
        fills: [solid(0.4627, 0.3059, 0.8667)], // #764edd
        strokes: [],
        strokeWidth: 0,
        strokeCap: 'butt',
        strokeJoin: 'miter',
        strokeMiterLimit: 4,
        fillRule: 'nonzero',
      },
    })
    const content = leaf({
      style: {
        fills: [solid(0, 0, 1)], // #0000ff
        strokes: [],
        strokeWidth: 0,
        strokeCap: 'butt',
        strokeJoin: 'miter',
        strokeMiterLimit: 4,
        fillRule: 'nonzero',
      },
    })
    const { markup, defs } = render(scene([mask, content]), 0, 0, OPTS)
    expect(defs).toContain('<clipPath id="f0_0">')
    expect(markup).toContain('clip-path="url(#f0_0)"')
    // Content is drawn; the mask's own color never is.
    expect(markup).toContain('fill="#0000ff"')
    expect(markup).not.toContain('764edd')
    // The clip geometry is a bare path with no paint.
    expect(defs).not.toContain('764edd')
  })

  it('uses an alpha <mask> for a group mask and walks its subtree', () => {
    // A group can't be a solid-opaque leaf, so it takes the soft-mask branch and
    // its subtree is rendered into the mask body.
    const inner = leaf({
      style: {
        fills: [solid(1, 1, 1)],
        strokes: [],
        strokeWidth: 0,
        strokeCap: 'butt',
        strokeJoin: 'miter',
        strokeMiterLimit: 4,
        fillRule: 'nonzero',
      },
    })
    const softMask = container([inner], { isMask: true })
    const content = leaf()
    const { markup, defs } = render(scene([softMask, content]), 0, 0, OPTS)
    expect(defs).toContain('mask-type="alpha"')
    expect(markup).toContain('mask="url(#f0_0)"')
    // Mask body contains the inner shape's path.
    expect(defs).toContain('<path')
  })

  it('bakes the mask and content in the same frame space (alignment)', () => {
    const mask = leaf({ isMask: true, restingMatrix: translate(5, 0) })
    const content = leaf({
      restingMatrix: translate(5, 0),
      style: {
        fills: [solid(0, 0, 1)],
        strokes: [],
        strokeWidth: 0,
        strokeCap: 'butt',
        strokeJoin: 'miter',
        strokeMiterLimit: 4,
        fillRule: 'nonzero',
      },
    })
    const { markup, defs } = render(scene([mask, content]), 0, 0, OPTS)
    // Both the clip geometry and the clipped content carry the same transform.
    expect(defs).toContain('matrix(1 0 0 1 5 0)')
    expect(markup).toContain('matrix(1 0 0 1 5 0)')
  })

  it('does not double-apply container opacity onto the mask wrapper', () => {
    const mask = leaf({ isMask: true })
    const content = leaf({
      style: {
        fills: [solid(0, 0, 1)],
        strokes: [],
        strokeWidth: 0,
        strokeCap: 'butt',
        strokeJoin: 'miter',
        strokeMiterLimit: 4,
        fillRule: 'nonzero',
      },
    })
    const root = scene([])
    root.root = container([mask, content], { baseOpacity: 0.5 })
    const { markup } = render(root, 0, 0, OPTS)
    // Opacity rides on the content leaf, not on the clip wrapper.
    expect(markup).toContain('<g clip-path="url(#f0_0)">')
    expect(markup).toContain('opacity="0.5"')
  })

  it('emits nothing for a mask with no following siblings', () => {
    const mask = leaf({ isMask: true })
    const { nodes, defsNodes } = render(scene([mask]), 0, 0, OPTS)
    expect(nodes).toEqual([])
    expect(defsNodes).toEqual([])
  })
})
