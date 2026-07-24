# Filmstrips

A filmstrip plays an animation from a single image. The image is a horizontal
strip of frames laid side by side (a sprite atlas), one cell per frame. A
CSS animation slides the strip left one cell at a time behind a window the size
of one cell, so only one frame shows at a time. Firefox uses this for toolbar
icon animations; the downloads button is a live example (`browser/themes/shared/downloads/indicator.css`).

The plugin bakes a Figma Motion animation into that strip and gives you the SVG
plus the numbers you need to animate it.

## Generating a strip

1. Select one frame on the canvas that has a Figma Motion animation.
2. Open the plugin and pick **Generate Filmstrips**. It reads the Motion
   timeline and samples it at 60fps, so a 0.5s animation bakes to 30 frames.
3. Optionally add pauses on the timeline (see below) to hold specific frames.
4. Download. **Standard** gives literal colors; **Firefox** emits
   `context-fill` / `context-stroke` paints and prepends a comment with the
   timing values for the CSS.

Frame count and duration come from the Motion timeline. Each cell is the size of
the source frame.

## Implementing a plain loop

For a strip with no pauses, the plugin's CSS snippet is:

```css
.filmstrip {
  width: 20px; /* one cell */
  height: 20px;
  overflow: hidden;
}
.filmstrip__strip {
  width: 520px; /* cell width * frame count (26) */
  height: 20px;
  background-image: url('filmstrip.svg');
  background-repeat: no-repeat;
  background-size: 520px 20px;
  animation: filmstrip-play 433ms steps(26, start) infinite;
}
@keyframes filmstrip-play {
  to {
    transform: translateX(-100%);
  }
}
```

`steps(26, start)` advances one cell per step. `translateX(-100%)` moves the
strip its full width over the animation duration.

One wrinkle: an N-cell strip translated a full `-100%` lands one cell past the
last frame on the final step, which reads as a blank frame. Firefox avoids this
by authoring the sprite one cell wider than the frame count, with the extra cell
repeating frame 0 as the loop-return pose (`width: calc(cellW * (frames + 1))`
in indicator.css). If your loop starts and ends on the same pose you can add
that duplicate cell, or translate to the last real frame instead of `-100%`.

## Adding pauses

A pause holds one frame in place for a set time before playback continues. In
Firefox's model a pause does not add image frames; it adds "wasted" timing steps
to the animation while the transform stays put. So a strip stays the same size,
but the animation runs longer.

`--anim-frames` is the real frame count. Each pause adds
`round(pause_ms / frame_ms)` steps, and `--anim-steps` is the sum. The animation
duration is `--anim-steps` times one frame's duration, and the keyframe
percentages are cumulative steps over `--anim-steps`.

The plugin does the arithmetic for you and puts it in the exported SVG's leading
comment. The downloads button's finish animation (26 frames, one ~1.67s pause at
frame 18) reduces to:

```css
#icon {
  --anim-frames: 26;
  --anim-steps: calc(var(--anim-frames) + 100); /* 100 steps of pause */
  width: calc(20px * (var(--anim-frames) + 1));
  transform: translateX(
    calc(var(--anim-frames) * -20px)
  ); /* resting end state */
}
#icon[animate] {
  animation: play calc(var(--anim-steps) * 16.667ms) infinite;
}
@keyframes play {
  from {
    animation-timing-function: steps(18);
    transform: translateX(0);
  }
  14.29% {
    /* reached frame 18 (18/126) */
    transform: translateX(calc(18 * -20px));
  }
  93.65% {
    /* pause done, resume (118/126) */
    animation-timing-function: steps(8);
    transform: translateX(calc(18 * -20px));
  }
}
```

The `animation-timing-function` on a keyframe applies to the interval that
starts at it: `steps(18)` covers frames 0 to 18, the flat stretch from 14.29% to
93.65% is the pause, and `steps(8)` covers frames 18 to 26. There is no `100%`
keyframe because the element's resting `transform` already holds the end state.

## Reading the export comment

The Firefox download starts with a comment holding a minimal, runnable CSS
block for that specific strip: an outer element clipped to one frame, an inner
element sized to the whole sprite, and an `@keyframes` with the step counts and
pauses already worked out. Paste it in, adjust the selectors and the `url()`,
and it plays.

```css
.filmstrip {
  width: 20px;
  height: 20px;
  overflow: hidden;
}
.filmstrip > .strip {
  width: 520px; /* 26 frames */
  height: 20px;
  background: url('filmstrip.svg') no-repeat;
  animation: filmstrip 2098ms infinite;
}
@keyframes filmstrip {
  from {
    animation-timing-function: steps(18);
    transform: translateX(0);
  }
  14.29% {
    transform: translateX(calc(18 * -20px));
  } /* hold frame 18 for 1667ms */
  93.65% {
    animation-timing-function: steps(8);
    transform: translateX(calc(18 * -20px));
  }
  to {
    transform: translateX(calc(26 * -20px));
  }
}
```

- The percentages are step-domain (each real frame and each pause step counts
  equally), matching how the `steps()` runs and the `animation-duration` line up.
- Hold keyframes report the frame and the duration you set in the plugin. The
  `steps()` counts round each pause to whole steps, so the CSS can differ from
  the plugin preview by a few ms.
- Values are hardcoded rather than CSS custom properties because an SVG comment
  can't contain a double hyphen. Swap in `--anim-frames` etc. if you prefer.
- `context-fill` / `context-stroke` colors tint from the element's `fill` /
  `stroke` (set `-moz-context-properties: fill, stroke`).
