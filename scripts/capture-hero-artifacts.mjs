/**
 * Capture hero critic artifacts at desktop 1280 against a production build.
 * Scroll targets are derived from the services scroll progress (same as CircleField).
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const OUT = path.join(process.cwd(), "docs/hero-artifacts");

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

async function scrollTo(page, y) {
  await page.evaluate((yy) => window.scrollTo(0, yy), Math.max(0, y));
  await page.waitForTimeout(1200);
}

async function scrollForProgress(page, m, target) {
  let lo = 0;
  let hi = m.docH;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const p = servicesProgress(mid, m.servicesTop, m.servicesH, m.viewH);
    if (p < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);

  const m = await layout(page);

  const shots = [
    {
      file: "hero-00-idle-field.png",
      y: 0,
      note: "Idle — box off-screen",
    },
    {
      file: "hero-01-orange.png",
      y: await scrollForProgress(page, m, 0.22),
      note: "Hero over orange as box appears",
    },
    {
      file: "hero-02-mid-handoff.png",
      y: await scrollForProgress(page, m, 0.38),
      note: "Mid handoff — straddle at lip",
    },
    {
      file: "hero-03-settled.png",
      y: await scrollForProgress(page, m, 0.52),
      note: "Settled card with copy",
    },
  ];

  for (const shot of shots) {
    await scrollTo(page, shot.y);
    await page.screenshot({
      path: path.join(OUT, shot.file),
      fullPage: false,
    });
    console.log(`✓ ${shot.file} — ${shot.note} (scrollY=${Math.round(shot.y)})`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
