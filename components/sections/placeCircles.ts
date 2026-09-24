import { clamp01, smoothstep } from "@/lib/math";
import { MOUTH_TRAVEL_CENTER } from "./serviceReveal";
import {
  boxBandFromMargin,
  pathEndpointLocal,
  type LayoutCache,
} from "./circleLayoutCache";

export type CircleModel = {
  origin: "hero" | "box";
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  dax: number;
  day: number;
  fx: number;
  fy: number;
  phase: number;
  pathDest?: "start" | "end";
  /** 0 = nearest camera tier, 1 = farthest. Consumed only by the 3D renderer. */
  depthTier?: number;
  /** Static rest tilt (radians) — 3D renderer only. */
  tiltX?: number;
  tiltY?: number;
  /** Idle micro-yaw phase — 3D renderer only. */
  spinPhase?: number;
  /** Lip-crossing offset (travel units) around PACK_CROSS_AT — hero chips only. */
  packOffset?: number;
  /** Narrow-box override of `packOffset`. */
  mPackOffset?: number;
  /** Curated landing slot for the narrow (9:16) box; falls back to toX/toY. */
  mToX?: number;
  mToY?: number;
};

export type CirclePose = {
  x: number;
  y: number;
  hidden: boolean;
  /** Per-chip travel after the pack warp (0 = hero, 1 = landed). */
  t: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const PATH_ARRIVED = 1 - 1e-4;

/**
 * Hero chips cross the lip together around this travel (each nudged by its
 * small `packOffset`), so the pack reads as one gesture, not a queue.
 */
export const PACK_CROSS_AT = MOUTH_TRAVEL_CENTER;
/**
 * Every chip is this far across horizontally when it meets the lip: it has
 * nearly reached its slot column, so the evenly spaced slots keep neighbours
 * apart through the crossing and the drop into the mouth reads straight down.
 */
const PACK_X_AT_LIP = 0.85;

function hermite(u: number, y0: number, y1: number, m0: number, m1: number) {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * y0 +
    (u3 - 2 * u2 + u) * m0 +
    (-2 * u3 + 3 * u2) * y1 +
    (u3 - u2) * m1
  );
}

/**
 * Monotone C1 remap of travel so a chip whose straight path reaches the lip at
 * `lipAt` does so at the shared `crossAt` instead, then eases into its slot.
 */
export function packWarp(p: number, lipAt: number, crossAt: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  if (!(lipAt > 0.02 && lipAt < 0.98) || !(crossAt > 0.05 && crossAt < 0.95)) return p;
  const P = crossAt;
  const L = lipAt;
  const dA = L / P;
  const dB = (1 - L) / (1 - P);
  // Carry real speed through the lip (no pile-up above it) while staying
  // inside the monotone bound on both segments.
  const m = Math.min((3.2 * dA * dB) / (dA + dB), 2.8 * dA, 2.8 * dB);
  if (p < P) return hermite(p / P, 0, L, dA * P, m * P);
  return hermite((p - P) / (1 - P), L, 1, m * (1 - P), 0.35 * dB * (1 - P));
}

export function placeCircles({
  circles,
  cache,
  travel,
  pathTravel,
  marginPx,
  scrollY,
  scrollX,
  viewportW,
  viewportH,
  time,
  rest,
  isDesktop,
  maxVisible,
  mobileHeroSlots,
  boxCount,
  visibleMask,
  pathEndpoints,
  driftScale = 1,
}: {
  circles: readonly CircleModel[];
  cache: LayoutCache;
  travel: number;
  pathTravel: number;
  marginPx: number;
  scrollY: number;
  scrollX: number;
  viewportW: number;
  viewportH: number;
  time: number;
  rest: boolean;
  isDesktop: boolean;
  maxVisible: number;
  mobileHeroSlots: readonly { x: number; y: number }[];
  boxCount: number;
  /** 0 = drift fully faded (idle-stopped), 1 = full drift. Renderer-driven. */
  driftScale?: number;
  /** Optional per-index visibility (mobile pool subset); ANDed with maxVisible. */
  visibleMask?: readonly boolean[];
  pathEndpoints?: {
    start: { x: number; y: number } | null;
    end: { x: number; y: number } | null;
  };
}): CirclePose[] {
  const out: CirclePose[] = new Array(circles.length);
  if (!cache.valid) {
    for (let i = 0; i < circles.length; i++) out[i] = { x: 0, y: 0, hidden: true, t: 0 };
    return out;
  }

  const p = rest ? 0 : clamp01(travel);
  const pt = rest ? 0 : clamp01(pathTravel);
  const ptEased = smoothstep(pt);
  const vmin = Math.min(viewportW, viewportH) / 100;
  const { bandLeft, bandW, bandTop, bandH } = boxBandFromMargin(cache, marginPx);
  const { heroW, heroH, heroSectionTop, heroSectionH } = cache;

  const pathStart =
    pt > 0
      ? (pathEndpoints?.start ??
        pathEndpointLocal(cache, marginPx, scrollY, scrollX, viewportH, "start"))
      : null;
  const pathEnd =
    pt > 0
      ? (pathEndpoints?.end ??
        pathEndpointLocal(cache, marginPx, scrollY, scrollX, viewportH, "end"))
      : null;

  for (let i = 0; i < circles.length; i++) {
    if (i >= maxVisible || (visibleMask && !visibleMask[i])) {
      out[i] = { x: 0, y: 0, hidden: true, t: 0 };
      continue;
    }

    const c = circles[i];
    const slotX = !isDesktop && c.mToX !== undefined ? c.mToX : c.toX;
    const slotY = !isDesktop && c.mToY !== undefined ? c.mToY : c.toY;
    let fromPxX: number;
    let fromPxY: number;
    const toPxX = bandLeft + slotX * bandW;
    const toPxY = bandTop + slotY * bandH;

    if (c.origin === "box") {
      fromPxX = toPxX;
      fromPxY = toPxY;
    } else if (!isDesktop) {
      const heroIndex = i - boxCount;
      const slot = mobileHeroSlots[heroIndex % mobileHeroSlots.length];
      fromPxX = slot.x * heroW;
      fromPxY = heroSectionTop + slot.y * heroSectionH;
    } else {
      fromPxX = c.fromX * heroW;
      fromPxY = c.fromY * heroH;
    }

    let coinP = c.origin === "box" ? 1 : p;
    let coinPX = coinP;
    if (c.origin === "hero") {
      const deltaY = toPxY - fromPxY;
      if (deltaY > 4) {
        const lipAt = (bandTop - fromPxY) / deltaY;
        const offset =
          !isDesktop && c.mPackOffset !== undefined ? c.mPackOffset : (c.packOffset ?? 0);
        const crossAt = PACK_CROSS_AT + offset;
        coinP = packWarp(p, lipAt, crossAt);
        coinPX = packWarp(p, PACK_X_AT_LIP, crossAt);
      }
    }

    let baseX = lerp(fromPxX, toPxX, coinPX);
    let baseY = lerp(fromPxY, toPxY, coinP);

    let isPathCircle = false;

    if (c.pathDest && pt > 0) {
      isPathCircle = true;
      const target = c.pathDest === "start" ? pathStart : pathEnd;
      if (target) {
        if (pt >= PATH_ARRIVED) {
          baseX = target.x;
          baseY = target.y;
        } else {
          baseX = lerp(toPxX, target.x, ptEased);
          baseY = lerp(toPxY, target.y, ptEased);
        }
      } else {
        baseX = toPxX;
        baseY = toPxY;
      }
    }

    const driftDampen = isPathCircle ? 0 : 1;
    const fallDrift = p > 0 && p < 1 ? Math.max(0, 1 - p * 2.5) : 1;
    const ds = driftDampen * fallDrift * driftScale;
    let dx = rest ? 0 : c.dax * vmin * Math.sin(time * c.fx + c.phase) * ds;
    let dy = rest ? 0 : c.day * vmin * Math.cos(time * c.fy + c.phase) * ds;

    // Padded clear zone around the hero headline: push hero coins out of an
    // elliptical hole around "Hi, my name is Marek" so they never sit on type.
    // Applies while the coin is still substantially in the hero (p small), and
    // eases out as it docks so it doesn't fight the scrub.
    if (c.origin === "hero" && p < 0.5) {
      const zoneGain = 1 - smoothstep(p / 0.5);
      const textCx = heroW * 0.5;
      const textCy = isDesktop
        ? heroH * 0.46
        : heroSectionTop + heroSectionH * 0.48;
      const zoneRx = heroW * (isDesktop ? 0.42 : 0.4);
      const zoneRy = (isDesktop ? heroH : heroSectionH) * (isDesktop ? 0.26 : 0.2);

      const fx = baseX + dx - textCx;
      const fy = baseY + dy - textCy;
      const nx = fx / zoneRx;
      const ny = fy / zoneRy;
      const d2 = nx * nx + ny * ny;

      if (d2 < 1 && d2 > 0.001) {
        const dist = Math.sqrt(d2);
        const push = (1 - dist) * (1 - dist) * 150 * zoneGain;
        dx += (nx / dist) * push;
        dy += (ny / dist) * push;
      }
    }

    out[i] = { x: baseX + dx, y: baseY + dy, hidden: false, t: coinP };
  }

  return out;
}

/** True when scrub is mid-flight — rAF should skip; scroll owns updates. */
export function isScrubbing(travel: number, pathTravel: number) {
  const p = clamp01(travel);
  const pt = clamp01(pathTravel);
  const midTravel = p > 0.001 && p < 0.999;
  const midPath = pt > 0.001 && pt < 0.999;
  return midTravel || midPath;
}
