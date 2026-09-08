import { clamp01, smoothstep } from "@/lib/math";
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
};

export type CirclePose = {
  x: number;
  y: number;
  hidden: boolean;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const PATH_ARRIVED = 1 - 1e-4;

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
  pathEndpoints,
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
  pathEndpoints?: {
    start: { x: number; y: number } | null;
    end: { x: number; y: number } | null;
  };
}): CirclePose[] {
  const out: CirclePose[] = new Array(circles.length);
  if (!cache.valid) {
    for (let i = 0; i < circles.length; i++) out[i] = { x: 0, y: 0, hidden: true };
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
    if (i >= maxVisible) {
      out[i] = { x: 0, y: 0, hidden: true };
      continue;
    }

    const c = circles[i];
    let fromPxX: number;
    let fromPxY: number;
    let toPxX: number;
    let toPxY: number;

    if (c.origin === "box") {
      fromPxX = bandLeft + c.fromX * bandW;
      fromPxY = bandTop + c.fromY * bandH;
      toPxX = fromPxX;
      toPxY = fromPxY;
    } else if (!isDesktop) {
      const heroIndex = i - boxCount;
      const slot = mobileHeroSlots[heroIndex % mobileHeroSlots.length];
      fromPxX = slot.x * heroW;
      fromPxY = heroSectionTop + slot.y * heroSectionH;
      toPxX = bandLeft + c.toX * bandW;
      toPxY = bandTop + c.toY * bandH;
    } else {
      fromPxX = c.fromX * heroW;
      fromPxY = c.fromY * heroH;
      toPxX = bandLeft + c.toX * bandW;
      toPxY = bandTop + c.toY * bandH;
    }

    let baseX = lerp(fromPxX, toPxX, p);
    let baseY = lerp(fromPxY, toPxY, p);

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
    let dx = rest
      ? 0
      : c.dax * vmin * Math.sin(time * c.fx + c.phase) * driftDampen * fallDrift;
    let dy = rest
      ? 0
      : c.day * vmin * Math.cos(time * c.fy + c.phase) * driftDampen * fallDrift;

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

    out[i] = { x: baseX + dx, y: baseY + dy, hidden: false };
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
