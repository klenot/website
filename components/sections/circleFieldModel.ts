import { placeCircles, type CircleModel } from "./placeCircles";

export type { CircleModel };
export { placeCircles };

/**
 * Logo discs shared by the DOM (`CircleField`) and WebGL (`CircleFieldThree`)
 * renderers. The first `BOX_COUNT` entries pre-seed the black services box; the
 * rest begin floating in the hero and travel into the box on scroll. Order is
 * load-bearing: `PATH_CIRCLE_*` indices below point into this array.
 */
export const CIRCLE_LOGOS: { file: string; size: number }[] = [
  // --- BOX (services) circles ---
  { file: "supabase.webp", size: 52 },
  { file: "gtm.webp", size: 36 },
  { file: "mixpanel.webp", size: 44 },
  { file: "python.webp", size: 60 },
  { file: "apollo.webp", size: 46 },
  { file: "linkedin.webp", size: 38 },
  { file: "openai.webp", size: 64 },
  { file: "smartlook.webp", size: 40 },
  { file: "duvo.webp", size: 44 },
  // --- HERO circles ---
  { file: "cursor.webp", size: 64 },
  { file: "gemini.webp", size: 56 },
  { file: "attio.webp", size: 38 },
  { file: "nexos.webp", size: 48 },
  { file: "analytics.webp", size: 36 },
  { file: "nextjs.webp", size: 60 },
  { file: "product-board.webp", size: 42 },
  { file: "pocketbase.webp", size: 38 },
  { file: "claude.webp", size: 58 },
  { file: "React.webp", size: 50 },
  { file: "framer.webp", size: 40 },
  { file: "cloudflare.webp", size: 46 },
  { file: "slack.webp", size: 36 },
];

/** Two hero discs that additionally lock onto the path endpoints (start / end). */
export const PATH_CIRCLE_CURSOR = 9;
export const PATH_CIRCLE_NEXTJS = 14;

export const BOX_COUNT = 9;
export const HERO_COUNT = 13;

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
  const minDist = 0.11;
  const slots: { x: number; y: number }[] = [];

  for (let i = 0; i < count; i++) {
    const isAbove = i < aboveCount;
    const yMin = isAbove ? 0.08 : 0.64;
    const yMax = isAbove ? 0.32 : 0.92;
    const xMin = isAbove ? 0.2 : 0.22;
    const xMax = isAbove ? 0.8 : 0.78;

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
    if (!placed) {
      slots.push({
        x: pick(xMin, xMax),
        y: pick(yMin, yMax),
      });
    }
  }

  return slots;
}

export const MOBILE_HERO_SLOTS = buildMobileHeroSlots(HERO_COUNT);

export function makeCircles(): CircleModel[] {
  const rand = mulberry32(20260702);
  const pick = (a: number, b: number) => a + rand() * (b - a);

  const TOTAL = BOX_COUNT + HERO_COUNT;
  const cols = Math.ceil(Math.sqrt(TOTAL * 1.6));
  const rows = Math.ceil(TOTAL / cols);
  const cellW = 0.84 / cols;
  const cellH = 0.6 / rows;
  const slots: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = 0.08 + (c + 0.5) * cellW;
      const cy = 0.12 + (r + 0.5) * cellH;
      slots.push({
        x: cx + pick(-cellW * 0.3, cellW * 0.3),
        y: cy + pick(-cellH * 0.3, cellH * 0.3),
      });
    }
  }
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const circles: CircleModel[] = [];

  const motionProps = () => ({
    dax: pick(0.6, 1.4),
    day: pick(0.6, 1.4),
    fx: pick(0.0004, 0.0009),
    fy: pick(0.0004, 0.0009),
    phase: pick(0, Math.PI * 2),
  });

  for (let i = 0; i < BOX_COUNT; i++) {
    const s = slots[i];
    circles.push({
      origin: "box",
      fromX: s.x,
      fromY: s.y,
      toX: s.x,
      toY: s.y,
      ...motionProps(),
    });
  }

  const heroCols = Math.ceil(Math.sqrt(HERO_COUNT * 1.5));
  const heroCellW = 0.8 / heroCols;
  const heroCellH = 0.7 / Math.ceil(HERO_COUNT / heroCols);
  for (let i = 0; i < HERO_COUNT; i++) {
    const s = slots[BOX_COUNT + i];
    const col = i % heroCols;
    const row = Math.floor(i / heroCols);
    const fromX = 0.1 + (col + 0.5) * heroCellW + pick(-heroCellW * 0.3, heroCellW * 0.3);
    const fromY = 0.12 + (row + 0.5) * heroCellH + pick(-heroCellH * 0.3, heroCellH * 0.3);
    circles.push({
      origin: "hero",
      fromX,
      fromY,
      toX: s.x,
      toY: s.y,
      ...motionProps(),
    });
  }

  circles[PATH_CIRCLE_CURSOR].pathDest = "start";
  circles[PATH_CIRCLE_NEXTJS].pathDest = "end";

  return circles;
}

export function logoScaleForWidth(w: number) {
  if (w < 480) return 0.72;
  if (w < 768) return 0.78;
  if (w < 1024) return 0.8;
  return 1;
}
