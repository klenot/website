import type { UseScrollOptions } from "motion/react";
import { smoothstep } from "@/lib/math";

// Scroll keyframes (fractions of the Services section's own scroll progress,
// measured with SPREAD_OFFSET) describing the black box as it spreads to
// full-bleed and shrinks back:
//   0.00–0.25  inset / narrowest
//   0.25–0.35  spreading out
//   0.35–0.80  full-bleed hold (extra long — circles settle mid-way through)
//   0.80–0.90  shrinking back
//   0.90–1.00  inset again
// Services maps these to marginX; CircleField travel (below) is scrubbed across
// the same progress so the logos glide with the box instead of teleporting.
export const SPREAD_BREAKPOINTS = [0, 0.25, 0.35, 0.8, 0.9, 1] as const;

// Side inset as a FRACTION of the container width. The box starts dramatically
// narrow and spreads wide — but KEEPS a gutter at max spread so it always reads
// as the black services *card* (not a full-bleed void). Responsive by
// construction: `spreadMarginPx()` multiplies by the live container width,
// keeping Services' marginX and CircleField's landing band in exact px lockstep.
export const SPREAD_INSET_FRAC = [0.17, 0.17, 0.035, 0.035, 0.17, 0.17] as const;

// Clamp so the inset never collapses to nothing on phones nor grows absurd on
// ultrawide displays.
const INSET_MIN_PX = 14;
const INSET_MAX_PX = 260;

/**
 * Side margin (px) of the services box at a given scroll progress, for a given
 * container width. Single source of truth shared by `Services` (visual box) and
 * the circle field (landing band) — they must never drift.
 */
export function spreadMarginPx(progress: number, width: number): number {
  const frac = interpolateProgress(progress, SPREAD_BREAKPOINTS, SPREAD_INSET_FRAC);
  if (frac <= 0) return 0;
  const px = frac * width;
  return Math.max(INSET_MIN_PX, Math.min(INSET_MAX_PX, px));
}

/** Narrowest inset (hero / card closed) — same as SPREAD_INSET_FRAC[0]. */
const SPREAD_INSET_NARROW = SPREAD_INSET_FRAC[0];
/** Widest inset (card open) — same as SPREAD_INSET_FRAC[2]. */
const SPREAD_INSET_WIDE = SPREAD_INSET_FRAC[2];

/**
 * Circle travel (`placeCircles` `travel` arg) derived from the live spread
 * inset so coin glide and box width scrub in lockstep (both directions).
 * 0 = hero, 1 = docked in the open card.
 */
export function circleTravelFromSpread(progress: number): number {
  const inset = interpolateProgress(progress, SPREAD_BREAKPOINTS, SPREAD_INSET_FRAC);
  const span = SPREAD_INSET_NARROW - SPREAD_INSET_WIDE;
  if (span <= 0) return 0;
  const t = (SPREAD_INSET_NARROW - inset) / span;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Services scroll progress where the mouth snapshot is taken (artifact script). */
export const MOUTH_SCROLL_CENTER = 0.3;

// The scroll offset both Services and CircleField MUST pass to useScroll for the
// breakpoints above to mean the same thing in both. Shared here so the whole
// coupling contract (keyframes + offset) lives in one place and can't drift.
export const SPREAD_OFFSET: UseScrollOptions["offset"] = ["start end", "end start"];

export function interpolateProgress(
  progress: number,
  breakpoints: readonly number[],
  values: readonly number[],
  easing: (t: number) => number = smoothstep,
): number {
  if (progress <= breakpoints[0]) return values[0];
  const last = breakpoints.length - 1;
  if (progress >= breakpoints[last]) return values[last];

  for (let i = 0; i < last; i++) {
    if (progress <= breakpoints[i + 1]) {
      const span = breakpoints[i + 1] - breakpoints[i];
      if (span === 0) return values[i + 1];
      const t = easing((progress - breakpoints[i]) / span);
      return values[i] + (values[i + 1] - values[i]) * t;
    }
  }

  return values[last];
}

/** Circle travel at MOUTH_SCROLL_CENTER — keep in sync with capture script. */
export const MOUTH_TRAVEL_CENTER = circleTravelFromSpread(MOUTH_SCROLL_CENTER);
