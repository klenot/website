import { placeCircles, type CircleModel } from "./placeCircles";

export type { CircleModel };
export { placeCircles };

/**
 * Curated logo discs shared by the DOM (`CircleField`) and WebGL
 * (`CircleFieldThree`) renderers. Deliberately few and large (~10) for a
 * restrained, premium coin cloud rather than a constellation. The first
 * `BOX_COUNT` entries pre-seed the black services box; the rest begin floating
 * in the hero and dock into the box on scroll. Order is load-bearing:
 * `PATH_CIRCLE_*` indices below point into this array.
 */
export const CIRCLE_LOGOS: { file: string; size: number }[] = [
  // --- BOX (services) coins ---
  { file: "openai.webp", size: 96 },
  { file: "supabase.webp", size: 78 },
  { file: "mixpanel.webp", size: 68 },
  { file: "python.webp", size: 86 },
  // --- HERO coins ---
  { file: "cursor.webp", size: 100 },
  { file: "nextjs.webp", size: 90 },
  { file: "claude.webp", size: 88 },
  { file: "React.webp", size: 80 },
  { file: "gemini.webp", size: 84 },
  { file: "framer.webp", size: 70 },
];

/** Two hero coins that additionally lock onto the path endpoints (start / end). */
export const PATH_CIRCLE_CURSOR = 4;
export const PATH_CIRCLE_NEXTJS = 5;

export const BOX_COUNT = 4;
export const HERO_COUNT = 6;

// Landed coins live in a TIGHT upper band of the box, so the empty strip above
// the bottom-pinned copy reads as intentional negative space (not a sparse void).
const BOX_BAND_TOP = 0.17;
const BOX_BAND_BOTTOM = 0.42;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildMobileHeroSlots(count: number): { x: number; y: number }[] {
  const rand = mulberry32(9080701);
  const pick = (a: number, b: number) => a + rand() * (b - a);

  const aboveCount = Math.ceil(count / 2);
  const minDist = 0.16;
  const slots: { x: number; y: number }[] = [];

  for (let i = 0; i < count; i++) {
    const isAbove = i < aboveCount;
    const yMin = isAbove ? 0.06 : 0.66;
    const yMax = isAbove ? 0.28 : 0.94;
    const xMin = isAbove ? 0.16 : 0.18;
    const xMax = isAbove ? 0.84 : 0.82;

    let placed = false;
    for (let attempt = 0; attempt < 48; attempt++) {
      const x = pick(xMin, xMax);
      const y = pick(yMin, yMax);
      const crowded = slots.some((s) => {
        const dx = s.x - x;
        const dy = s.y - y;
        return dx * dx + dy * dy < minDist * minDist;
      });
      if (!crowded) {
        slots.push({ x, y });
        placed = true;
        break;
      }
    }
    if (!placed) slots.push({ x: pick(xMin, xMax), y: pick(yMin, yMax) });
  }

  return slots;
}

export const MOBILE_HERO_SLOTS = buildMobileHeroSlots(HERO_COUNT);

export function makeCircles(): CircleModel[] {
  const rand = mulberry32(20260902);
  const pick = (a: number, b: number) => a + rand() * (b - a);

  const TOTAL = BOX_COUNT + HERO_COUNT;

  // Landing slots inside the box's upper band, spaced out (Poisson-ish) but
  // packed tighter for a denser cluster.
  const slots: { x: number; y: number }[] = [];
  const minDist = 0.13;
  for (let i = 0; i < TOTAL; i++) {
    let best = { x: 0.5, y: 0.4 };
    let bestD = -1;
    for (let attempt = 0; attempt < 40; attempt++) {
      const cand = {
        x: pick(0.12, 0.88),
        y: pick(BOX_BAND_TOP, BOX_BAND_BOTTOM),
      };
      let d = Infinity;
      for (const s of slots) {
        const dx = s.x - cand.x;
        const dy = s.y - cand.y;
        d = Math.min(d, dx * dx + dy * dy);
      }
      if (slots.length === 0) {
        best = cand;
        break;
      }
      if (d > bestD) {
        bestD = d;
        best = cand;
        if (d > minDist * minDist) break;
      }
    }
    slots.push(best);
  }
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const circles: CircleModel[] = [];

  // Three depth tiers cycled deterministically so near/mid/far are balanced.
  const depthTiers = [0.85, 0.15, 0.55, 0.35, 1, 0, 0.7, 0.25, 0.9, 0.45];

  const decor = (i: number) => ({
    dax: pick(0.5, 1.2),
    day: pick(0.5, 1.2),
    fx: pick(0.00035, 0.0007),
    fy: pick(0.00035, 0.0007),
    phase: pick(0, Math.PI * 2),
    depthTier: depthTiers[i % depthTiers.length],
    tiltX: pick(-0.16, 0.16),
    tiltY: pick(-0.2, 0.2),
    spinPhase: pick(0, Math.PI * 2),
  });

  for (let i = 0; i < BOX_COUNT; i++) {
    const s = slots[i];
    circles.push({
      origin: "box",
      fromX: s.x,
      fromY: s.y,
      toX: s.x,
      toY: s.y,
      ...decor(i),
    });
  }

  // Hero coins begin spread across the hero band, then dock to a box slot.
  const heroCols = Math.ceil(Math.sqrt(HERO_COUNT * 1.4));
  const heroCellW = 0.74 / heroCols;
  const heroRows = Math.ceil(HERO_COUNT / heroCols);
  const heroCellH = 0.66 / heroRows;
  for (let i = 0; i < HERO_COUNT; i++) {
    const s = slots[BOX_COUNT + i];
    const col = i % heroCols;
    const row = Math.floor(i / heroCols);
    const fromX = 0.13 + (col + 0.5) * heroCellW + pick(-heroCellW * 0.28, heroCellW * 0.28);
    const fromY = 0.1 + (row + 0.5) * heroCellH + pick(-heroCellH * 0.28, heroCellH * 0.28);
    circles.push({
      origin: "hero",
      fromX,
      fromY,
      toX: s.x,
      toY: s.y,
      ...decor(BOX_COUNT + i),
    });
  }

  circles[PATH_CIRCLE_CURSOR].pathDest = "start";
  circles[PATH_CIRCLE_NEXTJS].pathDest = "end";

  return circles;
}

export function logoScaleForWidth(w: number) {
  if (w < 480) return 0.82;
  if (w < 768) return 0.9;
  if (w < 1024) return 0.95;
  return 1;
}
