<script lang="ts">
  import { untrack } from 'svelte'
  import Button from 'tint/components/Button.svelte'
  import MenuInternal, {
    MenuBehavior,
    type MenuItem,
  } from 'tint/components/menu/MenuInternal.svelte'
  import SegmentedControl from 'tint/components/SegmentedControl.svelte'
  import Select from 'tint/components/Select.svelte'
  import TextField from 'tint/components/TextField.svelte'
  import IconPlay from 'tint/icons/20-play.svg?raw'
  import IconPause from 'tint/icons/20-pause.svg?raw'
  import IconRepeat from 'tint/icons/20-repeat.svg?raw'
  import IconSelectAll from 'tint/icons/20-select-all.svg?raw'
  import IconAdd from 'tint/icons/20-add.svg?raw'
  import IconRemove from 'tint/icons/20-remove.svg?raw'
  import IconTrash from 'tint/icons/20-trash.svg?raw'
  import AccentBar from '@ui/components/AccentBar.svelte'
  import Card from '@ui/components/Card.svelte'
  import { errorStore } from '@ui/store/error'
  import { filmstripsState } from '@ui/tools/filmstrips/store'
  import { downloadSvg } from '@ui/tools/filmstrips/download'
  import { formatSvg } from '@ui/tools/filmstrips/format-svg'
  import { optimizeSvg } from '@ui/tools/filmstrips/optimize-svg'
  import {
    buildSchedule,
    type PausePoint,
  } from '@tools/filmstrips/pause-schedule'
  import { computeFirefoxComment } from '@tools/filmstrips/firefox-comment'
  import type { ColorRole } from '@tools/filmstrips/types'

  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v))

  const result = $derived($filmstripsState.result)

  // Always previews the literal-color SVG: Firefox's context-fill /
  // context-stroke tokens only resolve inside Firefox's own chrome, not here.
  const previewUrl = $derived(
    result ? `data:image/svg+xml,${encodeURIComponent(result.svg)}` : null,
  )

  let playing = $state(true)
  let repeat = $state(true)

  // Preview-only 1s holds on the first and last frame. Kept out of the scrubber
  // schedule entirely: the animation just parks at the start/end for PAD_MS in
  // the background (scrubber stays at 0 / 1 during the hold).
  const PAD_MS = 1000
  let padEnds = $state(false)

  const ZOOM_MIN = 0.25
  const ZOOM_MAX = 8
  let zoom = $state(1)
  function zoomIn() {
    zoom = Math.min(ZOOM_MAX, +(zoom * 1.25).toFixed(3))
  }
  function zoomOut() {
    zoom = Math.max(ZOOM_MIN, +(zoom / 1.25).toFixed(3))
  }

  const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2]
  let playbackRate = $state(1)
  let showSpeedMenu = $state(false)
  let speedAnchor = $state<HTMLDivElement | undefined>(undefined)

  function formatSpeed(rate: number): string {
    return `${rate}×`
  }
  const speedMenuItems = $derived(
    SPEED_OPTIONS.map((rate) => ({
      label: rate === 1 ? 'Normal (1×)' : formatSpeed(rate),
      checked: playbackRate === rate,
      onClick: () => {
        playbackRate = rate
        showSpeedMenu = false
      },
    })) as MenuItem[],
  )

  // Pauses: pure UI-side timing metadata (nothing backend touches them). A
  // pause holds its frame for durationMs; the schedule turns the list into an
  // ordered play/hold segment sequence for one loop iteration.
  let pauses = $state<PausePoint[]>([])
  let editingPauseId = $state<string | null>(null)
  let pauseCardEl = $state<HTMLDivElement | undefined>(undefined)
  let pauseSeq = 0 // local id source; Figma's iframe may lack crypto.randomUUID

  const schedule = $derived(
    result ? buildSchedule(result.frameCount, result.durationMs, pauses) : null,
  )
  const totalDurationMs = $derived(schedule?.totalDurationMs ?? 0)
  const padMs = $derived(padEnds ? PAD_MS : 0)
  const animTotalMs = $derived(totalDurationMs + padMs * 2)
  const editingPause = $derived(
    pauses.find((p) => p.id === editingPauseId) ?? null,
  )

  // Hold segments only, for the pause pills on the scrubber.
  const holdSegments = $derived(
    (schedule?.segments ?? []).filter((s) => s.kind === 'hold'),
  )

  // Start time (ms, base timeline) of each displayed frame, in order — the
  // snap targets for scrubbing so the playhead lands on real frames.
  const frameStarts = $derived.by(() => {
    const sched = schedule
    if (!sched) return [] as number[]
    const total = sched.totalDurationMs || 1
    const out: number[] = []
    for (const seg of sched.segments) {
      if (seg.kind === 'play') {
        const span = seg.endPct - seg.startPct
        for (let j = 0; j < seg.steps; j++) {
          out.push((seg.startPct + span * (j / seg.steps)) * total)
        }
      } else {
        out.push(seg.startPct * total)
      }
    }
    return out
  })

  function snapTime(t: number): number {
    const fs = frameStarts
    if (fs.length === 0) return t
    let best = fs[0]
    let bestDist = Math.abs(t - best)
    for (const s of fs) {
      const d = Math.abs(t - s)
      if (d < bestDist) {
        bestDist = d
        best = s
      }
    }
    return best
  }

  let stripEl = $state<HTMLDivElement | null>(null)
  let animation = $state<Animation | null>(null)

  // Scrubbable timeline: poll currentTime into `progress` (0..1 over the base
  // schedule, pads excluded) via rAF; `scrubbing` hands control to the drag.
  let progress = $state(0)
  let scrubbing = $state(false)

  // Reset per-result authoring state when a fresh strip arrives.
  $effect(() => {
    const colors = result?.colors
    colorRoles = colors
      ? Object.fromEntries(
          colors.map((hex) => [hex, 'context-fill' as ColorRole]),
        )
      : {}
    pauses = []
    editingPauseId = null
  })

  // Build the preview animation as one keyframe per displayed frame, each held
  // flat via `step-end` (the value between two keyframes is always the earlier
  // one). No `steps()` interpolation, so every transform is an exact integer
  // cell offset and pauses are just keyframes with a distant neighbour. With
  // padEnds on, the base schedule is shifted into [PAD_MS, PAD_MS + total] and
  // frame 0 / the last frame hold through the leading / trailing pad. Reads
  // progress/playbackRate through untrack so it never rebuilds mid-playback.
  $effect(() => {
    const el = stripEl
    const r = result
    const sched = schedule
    if (!el || !r || !previewUrl || !sched || r.frameCount <= 1) {
      animation = null
      return
    }

    const cellW = r.cellW
    const base = sched.totalDurationMs
    const pad = padMs
    const total = base + pad * 2
    const shift = (offset: number) =>
      base > 0 ? (pad + offset * base) / total : 0

    const keyframes: { transform: string; offset: number; easing?: string }[] =
      []
    if (pad > 0) {
      keyframes.push({
        transform: 'translateX(0px)',
        offset: 0,
        easing: 'step-end',
      })
    }
    for (const seg of sched.segments) {
      if (seg.kind === 'play') {
        const span = seg.endPct - seg.startPct
        for (let j = 0; j < seg.steps; j++) {
          keyframes.push({
            transform: `translateX(${-(seg.fromFrame + j) * cellW}px)`,
            offset: shift(seg.startPct + span * (j / seg.steps)),
            easing: 'step-end',
          })
        }
      } else {
        keyframes.push({
          transform: `translateX(${-seg.atFrame * cellW}px)`,
          offset: shift(seg.startPct),
          easing: 'step-end',
        })
      }
    }
    // Terminal keyframe holds the last real frame to the loop edge, then wraps
    // to frame 0. Never emit -frameCount*cellW (past the atlas = blank).
    keyframes.push({
      transform: `translateX(${-(r.frameCount - 1) * cellW}px)`,
      offset: 1,
    })

    const anim = el.animate(keyframes, {
      duration: total,
      iterations: repeat ? Infinity : 1,
    })
    anim.currentTime = pad + untrack(() => progress) * base
    anim.playbackRate = untrack(() => playbackRate)

    const onFinish = () => {
      playing = false
    }
    anim.addEventListener('finish', onFinish)
    animation = anim
    return () => {
      anim.removeEventListener('finish', onFinish)
      anim.cancel()
      animation = null
    }
  })

  $effect(() => {
    if (animation) animation.playbackRate = playbackRate
  })

  $effect(() => {
    const a = animation
    if (!a || scrubbing) return
    if (playing) a.play()
    else a.pause()
  })

  $effect(() => {
    const a = animation
    if (!a) {
      progress = 0
      return
    }
    let rafId: number
    function tick() {
      if (a && !scrubbing) {
        const ct = typeof a.currentTime === 'number' ? a.currentTime : 0
        const dur = animTotalMs || 1
        const local = (((ct % dur) + dur) % dur) - padMs
        progress =
          totalDurationMs > 0 ? clamp(local / totalDurationMs, 0, 1) : 0
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  })

  // Close the pause editor on an outside click. Clicks on a pause pill are
  // "inside" (they select/drag a pause), so they don't close it. Registered
  // only while open, after the opening click has dispatched.
  $effect(() => {
    if (!editingPauseId) return
    function onDocClick(e: MouseEvent) {
      const t = e.target as HTMLElement
      if (pauseCardEl?.contains(t)) return
      if (t.closest?.('.pause-pill')) return
      editingPauseId = null
    }
    document.addEventListener('click', onDocClick, true)
    return () => document.removeEventListener('click', onDocClick, true)
  })

  const rawElapsedMs = $derived(progress * totalDurationMs)

  // Which frame is showing at the current scrub time (accounts for holds).
  const currentFrame = $derived.by(() => {
    const sched = schedule
    const r = result
    if (!sched || !r) return 0
    const total = sched.totalDurationMs || 1
    for (const seg of sched.segments) {
      if (rawElapsedMs > seg.endPct * total) continue
      if (seg.kind === 'hold') return seg.atFrame
      const startMs = seg.startPct * total
      const endMs = seg.endPct * total
      const frac =
        endMs > startMs ? (rawElapsedMs - startMs) / (endMs - startMs) : 0
      return Math.min(
        r.frameCount - 1,
        seg.fromFrame + Math.floor(frac * seg.steps),
      )
    }
    return r.frameCount - 1
  })

  // --- Custom scrubber: 24px thumb, so the travel is inset by its radius on
  // each side. Fill, pills and thumb all use the same basis so they align. ---
  const THUMB = 24
  let scrubberEl = $state<HTMLDivElement | null>(null)

  function posFor(fraction: number): string {
    return `calc(${THUMB / 2}px + ${clamp(fraction, 0, 1)} * (100% - ${THUMB}px))`
  }
  const thumbLeft = $derived(posFor(progress))
  const fillWidth = $derived(posFor(progress))

  function seekTo(baseMs: number) {
    const t = snapTime(clamp(baseMs, 0, totalDurationMs))
    progress = totalDurationMs > 0 ? t / totalDurationMs : 0
    if (animation) animation.currentTime = padMs + t
  }
  function fracFromPointer(e: PointerEvent): number {
    if (!scrubberEl) return 0
    const rect = scrubberEl.getBoundingClientRect()
    const usable = rect.width - THUMB
    return usable > 0
      ? clamp((e.clientX - rect.left - THUMB / 2) / usable, 0, 1)
      : 0
  }
  function onScrubDown(e: PointerEvent) {
    scrubberEl?.setPointerCapture(e.pointerId)
    scrubbing = true
    playing = false
    animation?.pause()
    seekTo(fracFromPointer(e) * totalDurationMs)
  }
  function onScrubMove(e: PointerEvent) {
    if (!scrubbing) return
    seekTo(fracFromPointer(e) * totalDurationMs)
  }
  function onScrubUp(e: PointerEvent) {
    scrubbing = false
    scrubberEl?.releasePointerCapture(e.pointerId)
  }
  function onScrubKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const fs = frameStarts
    if (fs.length === 0) return
    let idx = fs.indexOf(snapTime(rawElapsedMs))
    if (idx < 0) idx = 0
    idx = clamp(idx + (e.key === 'ArrowRight' ? 1 : -1), 0, fs.length - 1)
    playing = false
    animation?.pause()
    seekTo(fs[idx])
  }

  // Drag a pause pill to move it (body) or resize its duration (right-edge
  // handle). Relative dragging (start value + pixel delta) rather than absolute
  // pointer mapping, so the reflowing timeline doesn't make it jumpy. Both are
  // frame-stepped: move snaps atFrame to whole frames, resize snaps the
  // duration to whole frames (frameStepMs multiples).
  let pillDrag = $state<{
    id: string
    mode: 'move' | 'resize'
    startX: number
    startAtFrame: number
    startDurationMs: number
    usable: number
  } | null>(null)

  function onPillDown(
    e: PointerEvent,
    pauseId: string,
    atFrame: number,
    durationMs: number,
  ) {
    e.stopPropagation()
    editingPauseId = pauseId
    const pill = e.currentTarget as HTMLElement
    pill.setPointerCapture(e.pointerId)
    const onHandle = !!(e.target as HTMLElement).closest?.('.pause-resize')
    const rect = scrubberEl?.getBoundingClientRect()
    pillDrag = {
      id: pauseId,
      mode: onHandle ? 'resize' : 'move',
      startX: e.clientX,
      startAtFrame: atFrame,
      startDurationMs: durationMs,
      usable: Math.max(1, (rect?.width ?? 1) - THUMB),
    }
  }
  function onPillMove(e: PointerEvent) {
    const drag = pillDrag
    if (!drag || !result) return
    const dx = e.clientX - drag.startX
    if (drag.mode === 'move') {
      const pxPerFrame = drag.usable / Math.max(1, result.frameCount - 1)
      const delta = Math.round(dx / pxPerFrame)
      updatePause(drag.id, { atFrame: drag.startAtFrame + delta })
    } else {
      const frameStepMs = result.durationMs / result.frameCount
      const msPerPx = (totalDurationMs || 1) / drag.usable
      const frames = Math.max(
        1,
        Math.round((drag.startDurationMs + dx * msPerPx) / frameStepMs),
      )
      updatePause(drag.id, { durationMs: frames * frameStepMs })
    }
  }
  function onPillUp(e: PointerEvent) {
    pillDrag = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }

  function addPauseAtPlayhead() {
    if (!result) return
    const id = `p${++pauseSeq}`
    pauses = [...pauses, { id, atFrame: currentFrame, durationMs: 500 }].sort(
      (a, b) => a.atFrame - b.atFrame,
    )
    editingPauseId = id
  }
  function updatePause(
    id: string,
    patch: Partial<Pick<PausePoint, 'atFrame' | 'durationMs'>>,
  ) {
    if (!result) return
    const maxFrame = result.frameCount - 1
    pauses = pauses
      .map((p) => {
        if (p.id !== id) return p
        const next = { ...p, ...patch }
        next.atFrame = Math.min(maxFrame, Math.max(0, Math.round(next.atFrame)))
        next.durationMs = Math.max(1, Math.round(next.durationMs))
        return next
      })
      .sort((a, b) => a.atFrame - b.atFrame)
  }
  function deletePause(id: string) {
    pauses = pauses.filter((p) => p.id !== id)
    if (editingPauseId === id) editingPauseId = null
  }

  function handleDownload(svg: string) {
    if (!result) return
    downloadSvg(svg, `${result.sourceName}-filmstrip.svg`)
  }

  // Firefox treats context-fill as an icon's default/primary color and
  // context-stroke as a secondary color used only for a second tone — not a
  // literal fill-vs-stroke split — so unmapped colors default to context-fill
  // (see paintFor in render-frame.ts) and only 2+ colors get a per-color picker.
  let downloadFormat = $state<'firefox' | 'other'>('firefox')
  let colorRoles = $state<Record<string, ColorRole>>({})
  let renderingFirefox = $state(false)

  async function handleDownloadClick() {
    if (!result) return
    playing = false

    let svg: string
    if (downloadFormat === 'firefox' && result.colors) {
      renderingFirefox = true
      // Snapshot the reactive proxy: a $state Proxy can't be structure-cloned
      // by postMessage (DataCloneError), so send a plain object to the backend.
      const response = await errorStore.safeRequest(
        'filmstrip:render-context',
        $state.snapshot(colorRoles),
      )
      renderingFirefox = false
      if (!response?.svg) return
      svg = response.svg
    } else {
      svg = result.svg
    }

    // Intern duplicated geometry into <defs>/<use> (roughly halves the file),
    // then pretty-print the result. Both run before the comment is prepended so
    // its own formatting stays.
    svg = optimizeSvg(svg)
    svg = formatSvg(svg)

    // The Firefox format prepends the timing comment (pauses + keyframe
    // schedule) whether or not there were colors to remap.
    if (downloadFormat === 'firefox') {
      svg =
        computeFirefoxComment(
          result.frameCount,
          result.durationMs,
          result.cellW,
          result.cellH,
          pauses,
        ) +
        '\n' +
        svg
    }
    handleDownload(svg)
  }

  const COLOR_ROLE_ITEMS: { value: ColorRole; label: string }[] = [
    { value: 'context-fill', label: 'Default color (fill)' },
    { value: 'context-stroke', label: 'Accent color (stroke)' },
    { value: 'literal', label: 'Hardcode color' },
  ]

  const DOWNLOAD_FORMAT_ITEMS: {
    value: 'firefox' | 'other'
    label: string
  }[] = [
    { value: 'firefox', label: 'Firefox' },
    { value: 'other', label: 'Other' },
  ]

  let placing = $state(false)
  async function handlePlaceInFigma() {
    placing = true
    await errorStore.safeRequest('filmstrip:place-in-figma')
    placing = false
  }
</script>

{#if result}
  <AccentBar icon={IconPlay} label={result.sourceName} />

  <div class="body">
    <div class="preview-controls">
      <div class="controls-group">
        <Button icon small variant="ghost" tooltip="Zoom out" onclick={zoomOut}>
          {@html IconRemove}
        </Button>
        <Button
          small
          variant="ghost"
          tooltip="Reset zoom"
          onclick={() => (zoom = 1)}
        >
          {Math.round(zoom * 100)}%
        </Button>
        <Button icon small variant="ghost" tooltip="Zoom in" onclick={zoomIn}>
          {@html IconAdd}
        </Button>
      </div>
      <div class="controls-group">
        <div class="speed-anchor" bind:this={speedAnchor}>
          <Button
            small
            variant="ghost"
            tooltip="Playback speed"
            aria-haspopup="menu"
            aria-expanded={showSpeedMenu}
            onclick={() => (showSpeedMenu = !showSpeedMenu)}
          >
            {formatSpeed(playbackRate)}
          </Button>
        </div>
        <Button
          icon
          small
          variant="ghost"
          toggled={padEnds}
          tooltip="Hold the first and last frame for 1s (preview only)"
          onclick={() => (padEnds = !padEnds)}
        >
          {@html IconSelectAll}
        </Button>
      </div>
    </div>

    <div class="preview">
      {#if previewUrl}
        <div
          class="viewport"
          style="width:{result.cellW}px;height:{result.cellH}px;transform:scale({zoom})"
        >
          <div
            class="strip"
            bind:this={stripEl}
            style:width="{result.width}px"
            style:height="{result.cellH}px"
            style:background-image="url('{previewUrl}')"
            style:background-size="{result.width}px {result.cellH}px"
          ></div>
        </div>
      {/if}
    </div>

    <div class="timeline">
      <div
        class="scrubber"
        bind:this={scrubberEl}
        role="slider"
        tabindex="0"
        aria-label="Scrub filmstrip animation"
        aria-valuemin={0}
        aria-valuemax={result.frameCount - 1}
        aria-valuenow={currentFrame}
        onpointerdown={onScrubDown}
        onpointermove={onScrubMove}
        onpointerup={onScrubUp}
        onkeydown={onScrubKey}
      >
        <div class="scrubber-clip">
          <div class="track"></div>
          <div class="fill" style:width={fillWidth}></div>
        </div>
        {#each holdSegments as seg (seg.kind === 'hold' ? seg.pauseId : '')}
          {#if seg.kind === 'hold'}
            <button
              type="button"
              class="pause-pill"
              class:editing={seg.pauseId === editingPauseId}
              style:left={posFor(seg.startPct)}
              style:width="calc({seg.endPct - seg.startPct} * (100% - {THUMB}px))"
              aria-label="Edit pause at frame {seg.atFrame}"
              onpointerdown={(e) =>
                onPillDown(e, seg.pauseId, seg.atFrame, seg.durationMs)}
              onpointermove={onPillMove}
              onpointerup={onPillUp}
            >
              <span class="pause-pill-icon">{@html IconPause}</span>
              <span class="pause-resize" aria-hidden="true"></span>
            </button>
          {/if}
        {/each}
        <div class="thumb" style:left={thumbLeft}></div>
      </div>
      <Button
        icon
        small
        variant="ghost"
        tooltip="Add pause at playhead"
        onclick={addPauseAtPlayhead}
      >
        {@html IconAdd}
      </Button>
    </div>

    <div class="transport">
      <div class="controls-group">
        <Button
          icon
          small
          variant="ghost"
          tooltip={playing ? 'Pause' : 'Play'}
          onclick={() => (playing = !playing)}
        >
          {@html playing ? IconPause : IconPlay}
        </Button>
        <Button
          icon
          small
          variant="ghost"
          toggled={repeat}
          tooltip="Loop"
          onclick={() => (repeat = !repeat)}
        >
          {@html IconRepeat}
        </Button>
      </div>
      <span class="frame-readout tint--type-ui-small">
        Frame {currentFrame + 1} / {result.frameCount}
      </span>
    </div>

    {#if editingPause}
      {@const ep = editingPause}
      <Card bind:element={pauseCardEl}>
        <div class="pause-editor">
          <div class="pause-editor-fields">
            <TextField
              label="Frame"
              type="number"
              value={String(ep.atFrame)}
              oncommit={(v: string) =>
                updatePause(ep.id, { atFrame: parseInt(v) || 0 })}
            />
            <TextField
              label="Pause (ms)"
              type="number"
              value={String(ep.durationMs)}
              oncommit={(v: string) =>
                updatePause(ep.id, { durationMs: parseInt(v) || 1 })}
            />
          </div>
          <Button
            icon
            variant="ghost"
            tooltip="Delete pause"
            aria-label="Delete pause"
            onclick={() => deletePause(ep.id)}
          >
            {@html IconTrash}
          </Button>
        </div>
      </Card>
    {/if}

    <Card>
      <div class="download-card">
        {#if result.colors}
          <div class="download-format">
            <SegmentedControl
              id="download-format"
              label="Download format"
              items={DOWNLOAD_FORMAT_ITEMS}
              value={downloadFormat}
              onchange={(v) => (downloadFormat = v)}
            />
          </div>

          {#if downloadFormat === 'other'}
            <p class="tint--type-ui color-roles-hint">
              Export the filmstrip with all colors hardcoded. This is the only
              option for non-Firefox browsers.
            </p>
          {/if}

          {#if downloadFormat === 'firefox'}
            <div class="color-roles">
              <p class="tint--type-ui color-roles-hint">
                Firefox recolors icons via <strong>context-fill</strong> (the
                icon's default color) and optionally
                <strong>context-stroke</strong> (a secondary accent color).
              </p>
              {#if result.colors.length >= 2}
                <p class="tint--type-ui color-roles-hint">
                  Since the animation contains more than one color, please
                  assign each color a role or keep it hardcoded.
                </p>
                {#each result.colors as hex (hex)}
                  <div class="color-role-row">
                    <span
                      class="swatch"
                      style:background={hex}
                      aria-hidden="true"
                    ></span>
                    <span class="swatch-hex tint--type-ui-small">{hex}</span>
                    <Select
                      id="color-role-{hex}"
                      label="Role"
                      fillWidth={false}
                      items={COLOR_ROLE_ITEMS}
                      value={colorRoles[hex]}
                      onchange={(e) =>
                        (colorRoles[hex] = (e.target as HTMLSelectElement)
                          .value as ColorRole)}
                    />
                  </div>
                {/each}
              {:else}
                <p class="tint--type-ui color-roles-hint">
                  The animation uses a single color, so it's all exported as
                  <strong>context-fill</strong>.
                </p>
              {/if}
            </div>
          {/if}
        {/if}

        <div class="download-action">
          <Button
            variant="primary"
            onclick={handleDownloadClick}
            loading={renderingFirefox}
          >
            Download
          </Button>
        </div>
      </div>
    </Card>

    <div class="place-action">
      <Button
        variant="secondary"
        onclick={handlePlaceInFigma}
        loading={placing}
      >
        Place in Figma
      </Button>
    </div>
  </div>
{/if}

{#if showSpeedMenu}
  <MenuInternal
    behavior={MenuBehavior.SELECT}
    items={speedMenuItems}
    anchorRef={speedAnchor}
    closeOnClick
    hide={() => (showSpeedMenu = false)}
  />
{/if}

<style lang="sass">
.body
  display: flex
  flex-direction: column
  gap: tint.$size-12
  padding: tint.$size-16

.preview-controls
  display: flex
  flex-wrap: wrap
  align-items: center
  justify-content: space-between
  gap: tint.$size-8

.preview
  display: flex
  align-items: center
  justify-content: center
  box-sizing: border-box
  width: 100%
  aspect-ratio: 16 / 10
  border-radius: tint.$size-8
  background-color: var(--tint-input-bg)
  background-image: linear-gradient(45deg, var(--tint-card-border) 25%, transparent 25%), linear-gradient(-45deg, var(--tint-card-border) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--tint-card-border) 75%), linear-gradient(-45deg, transparent 75%, var(--tint-card-border) 75%)
  background-size: 16px 16px
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px
  overflow: auto

.viewport
  overflow: hidden
  flex-shrink: 0
  transform-origin: center center

.strip
  background-repeat: no-repeat

.timeline
  display: flex
  align-items: center
  gap: tint.$size-4

.scrubber
  position: relative
  flex: 1
  min-width: 0
  height: 28px
  touch-action: none
  cursor: pointer
  &:focus-visible
    outline: 2px solid var(--tint-action-primary)
    outline-offset: 2px

// Rounds the track + fill without clipping the thumb (which overhangs the
// track ends) — the thumb and pills are siblings of this, not children.
.scrubber-clip
  position: absolute
  inset: 0
  border-radius: 14px
  overflow: hidden
  pointer-events: none

.track
  position: absolute
  inset: 0
  background: var(--tint-input-bg)

.fill
  position: absolute
  top: 0
  left: 0
  height: 100%
  // No radius here: the rounded shape comes from `.scrubber-clip`, so the
  // fill's right (playhead) edge stays flat.
  background: var(--tint-action-primary)
  pointer-events: none

.pause-pill
  position: absolute
  top: 0
  height: 100%
  z-index: 1
  box-sizing: border-box
  min-width: 20px
  padding: 0
  display: flex
  align-items: center
  justify-content: center
  border: 2px solid currentColor
  border-radius: tint.$size-8
  // 75% white so the pill reads correctly over both the green fill and the
  // grey track.
  background: color-mix(in srgb, #fff 75%, transparent)
  color: var(--tint-action-primary)
  cursor: grab
  touch-action: none
  &:hover
    background: #fff
  &.editing
    background: var(--tint-action-primary)
    color: var(--tint-action-primary-text)
  .pause-pill-icon
    display: flex
    :global(svg)
      width: 12px
      height: 12px

.pause-resize
  position: absolute
  top: 0
  right: 0
  width: 8px
  height: 100%
  cursor: ew-resize

.thumb
  position: absolute
  top: 50%
  z-index: 2
  width: 24px
  height: 24px
  transform: translate(-50%, -50%)
  border-radius: 50%
  background: var(--tint-bg)
  border: 2px solid var(--tint-action-primary)
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1)
  // Catch pointerdowns over an overlapping pause pill (thumb is on top): the
  // event bubbles to the scrubber and scrubs, instead of the pill beneath it
  // starting a pause drag. Cursor inherits the scrubber's.
  pointer-events: auto

.transport
  display: flex
  align-items: center
  gap: tint.$size-8

.frame-readout
  color: var(--tint-text-secondary)
  font-variant-numeric: tabular-nums

.controls-group
  display: flex
  align-items: center
  gap: tint.$size-4

.speed-anchor
  display: flex

.pause-editor
  display: flex
  align-items: flex-start
  gap: tint.$size-8

.pause-editor-fields
  display: flex
  gap: tint.$size-8
  flex: 1
  min-width: 0

.download-card
  display: flex
  flex-direction: column
  gap: tint.$size-12

.download-action
  display: flex
  :global(.tint--button)
    flex: 1

.place-action
  display: flex
  justify-content: center

.download-format
  display: flex

.color-roles
  display: flex
  flex-direction: column
  gap: tint.$size-8

.color-roles-hint
  color: var(--tint-text-secondary)

.color-role-row
  display: flex
  align-items: center
  gap: tint.$size-8

.swatch
  flex-shrink: 0
  width: tint.$size-24
  height: tint.$size-24
  border-radius: tint.$size-4
  border: 1px solid var(--tint-card-border)

.swatch-hex
  flex-shrink: 0
  width: 64px
  color: var(--tint-text-secondary)
  font-family: monospace
</style>
