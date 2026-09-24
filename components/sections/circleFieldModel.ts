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


export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hand-placed (by hero index) so the visible mobile hero chips frame the
// headline — two above, two below — instead of clumping in one corner.
export const MOBILE_HERO_SLOTS: readonly { x: number; y: number }[] = [
  { x: 0.25, y: 0.17 }, // cursor
  { x: 0.74, y: 0.26 }, // nextjs
  { x: 0.76, y: 0.72 }, // claude
  { x: 0.5, y: 0.9 },
  { x: 0.27, y: 0.8 }, // gemini
  { x: 0.5, y: 0.1 },
];

export function makeCircles(): CircleModel[] {
  const rand = mulberry32(20260902);
  const pick = (a: number, b: number) => a + rand() * (b - a);

  // Settled flock (band fractions): a staggered upper row of six hero slots,
  // evenly spaced so neighbours clear each other even while crossing the lip
  // together, and four seeded box chips nested one row deeper between them
  // (incoming chips land above them and never pass over one).
  const slotRand = mulberry32(7310452);
  const jitter = (amt: number) => (slotRand() * 2 - 1) * amt;
  const heroSlotList = Array.from({ length: HERO_COUNT }, (_, k) => ({
    x: 0.15 + k * 0.14 + jitter(0.012),
    y: (k % 2 === 0 ? 0.2 : 0.28) + jitter(0.015),
  }));
  const boxSlotList = [0.22, 0.4, 0.6, 0.78].map((x, k) => ({
    x: x + jitter(0.012),
    y: (k % 2 === 0 ? 0.43 : 0.46) + jitter(0.012),
  }));
  const slots = [...boxSlotList, ...heroSlotList];

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
  // Hero chips take the upper-row slots in left-to-right order, so flight
  // paths never cross and the pack pours in as one clean sheet.
  const heroSlots = slots.slice(BOX_COUNT);
  const heroStart = circles.length;
  for (let i = 0; i < HERO_COUNT; i++) {
    const col = i % heroCols;
    const row = Math.floor(i / heroCols);
    const fromX = 0.13 + (col + 0.5) * heroCellW + pick(-heroCellW * 0.28, heroCellW * 0.28);
    const fromY = 0.1 + (row + 0.5) * heroCellH + pick(-heroCellH * 0.28, heroCellH * 0.28);
    circles.push({
      origin: "hero",
      fromX,
      fromY,
      toX: 0,
      toY: 0,
      ...decor(BOX_COUNT + i),
    });
  }
  // Lip timing: one shared beat — neighbours zipped a hair apart, centre
  // slightly first, near tier a touch ahead of far. Window ≈ 0.08 travel.
  circles
    .slice(heroStart)
    .sort((a, b) => a.fromX - b.fromX)
    .forEach((c, rank) => {
      c.toX = heroSlots[rank].x;
      c.toY = heroSlots[rank].y;
      const zip = rank % 2 === 0 ? -0.022 : 0.022;
      const centreOut = Math.abs(c.toX - 0.5) * 0.04;
      const nearLead = ((c.depthTier ?? 0.5) - 0.5) * 0.02;
      c.packOffset = zip + centreOut + nearLead;
    });

  circles[PATH_CIRCLE_CURSOR].pathDest = "start";
  circles[PATH_CIRCLE_NEXTJS].pathDest = "end";

  for (let i = 0; i < circles.length; i++) {
    const m = MOBILE_BOX_SLOTS[i];
    circles[i].mToX = m.x;
    circles[i].mToY = m.y;
    circles[i].mPackOffset = m.po;
  }

  return circles;
}

/**
 * Mobile pool (~6 flat chips): 2 pre-seeded box chips + 4 hero chips, so the
 * phone hero isn't a near-empty field and the pack still has a cast.
 */
export const MOBILE_POOL: readonly number[] = [0, 1, 4, 5, 6, 8];
export const MOBILE_VISIBLE_MASK: readonly boolean[] = CIRCLE_LOGOS.map((_, i) =>
  MOBILE_POOL.includes(i),
);

// Tidy staggered pack for the tall 9:16 box (band fractions). Seeded box chips
// sit on the lower row so incoming chips never pass over them; each hero chip
// lands on the side it starts from, and `po` sequences the lip in three quick
// beats (deepest first, sides last, ~0.07 apart) — the narrow box can't take
// four at once.
const MOBILE_BOX_SLOTS: readonly { x: number; y: number; po?: number }[] = [
  { x: 0.27, y: 0.52 }, // openai
  { x: 0.73, y: 0.52 }, // supabase
  { x: 0.3, y: 0.66 },
  { x: 0.7, y: 0.66 },
  { x: 0.27, y: 0.12, po: 0.07 }, // cursor
  { x: 0.73, y: 0.12, po: 0.07 }, // nextjs
  { x: 0.5, y: 0.255, po: 0 }, // claude
  { x: 0.5, y: 0.75 },
  { x: 0.5, y: 0.39, po: -0.075 }, // gemini
  { x: 0.5, y: 0.8 },
];

export function logoScaleForWidth(w: number) {
  if (w < 480) return 0.82;
  if (w < 768) return 0.9;
  if (w < 1024) return 0.95;
  return 1;
}
