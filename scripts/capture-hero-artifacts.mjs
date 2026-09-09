/**
 * Capture hero critic artifacts at desktop 1280 against a production build.
 * Labels: true-idle (box off-screen) / mid-2-3-straddles / settled.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const OUT = path.join(process.cwd(), "docs/hero-artifacts");

// Keep in sync with MOUTH_SCROLL_CENTER in serviceReveal.ts (mid spread phase).
const MOUTH_SCROLL_CENTER = 0.3;
const SETTLED_TRAVEL = 0.54;

/** Mirror motion `useScroll` offset ["start end", "end start"] for #services. */
function servicesProgress(scrollY, servicesTop, servicesH, viewH) {
  const start = servicesTop - viewH;
  const end = servicesTop + servicesH;
  if (end <= start) return 0;
  return Math.max(0, Math.min(1, (scrollY - start) / (end - start)));
}

async function layout(page) {
  return page.evaluate(() => {
    const hero = document.getElementById("hero");
    const services = document.getElementById("services");
    const box = services?.querySelector("[class*='aspect']");
    const heroRect = hero?.getBoundingClientRect();
    const servicesRect = services?.getBoundingClientRect();
    const boxRect = box?.getBoundingClientRect();
    return {
      viewH: window.innerHeight,
      docH: document.documentElement.scrollHeight - window.innerHeight,
      heroTop: heroRect ? heroRect.top + window.scrollY : 0,
      heroH: heroRect?.height ?? 0,
      servicesTop: servicesRect ? servicesRect.top + window.scrollY : 0,
      servicesH: servicesRect?.height ?? 0,
      boxTop: boxRect ? boxRect.top + window.scrollY : 0,
      boxH: boxRect?.height ?? 0,
    };
  });
}

async function assertBoxOffScreen(page) {
  const ok = await page.evaluate(() => {
    const box = document.getElementById("services")?.querySelector("[class*='aspect']");
    if (!box) return false;
    const rect = box.getBoundingClientRect();
    return rect.top >= window.innerHeight - 2;
  });
  if (!ok) {
    throw new Error("Idle artifact: services box is still visible in the viewport");
  }
}

async function scrollTo(page, y) {
  await page.evaluate((yy) => window.scrollTo(0, yy), Math.max(0, y));
  await page.waitForTimeout(1300);
}

async function scrollForProgress(page, m, target) {
  let lo = 0;
  let hi = m.docH;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    const p = servicesProgress(mid, m.servicesTop, m.servicesH, m.viewH);
    if (p < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

async function loadIdle(page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => sessionStorage.setItem("hero-capture-idle", "1"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await assertBoxOffScreen(page);
}

async function loadScrollSession(page) {
  await page.evaluate(() => sessionStorage.removeItem("hero-capture-idle"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2800);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // --- True idle (box fully below viewport, frozen headline) ---
  await loadIdle(page);
  await page.screenshot({
    path: path.join(OUT, "hero-00-idle-field.png"),
    fullPage: false,
  });
  console.log("✓ hero-00-idle-field.png — True idle — full hero field, box fully off-screen");

  // --- Scroll-based shots (headline auto-hides once mouth opens) ---
  await loadScrollSession(page);
  const m = await layout(page);

  const scrollShots = [
    {
      file: "hero-01-orange.png",
      progress: 0.2,
      note: "Hero over orange as box begins to appear",
    },
    {
      file: "hero-02-mid-handoff.png",
      progress: MOUTH_SCROLL_CENTER,
      note: "Mid handoff — 2–3 chips straddling the lip",
    },
    {
      file: "hero-03-settled.png",
      progress: SETTLED_TRAVEL,
      note: "Settled card with padded copy",
    },
  ];

  for (const shot of scrollShots) {
    await scrollTo(page, await scrollForProgress(page, m, shot.progress));
    await page.screenshot({
      path: path.join(OUT, shot.file),
      fullPage: false,
    });
    console.log(`✓ ${shot.file} — ${shot.note}`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
