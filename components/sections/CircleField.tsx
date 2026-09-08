"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  animate,
  useAnimationFrame,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import type { MotionValue } from "motion/react";
import {
  CIRCLE_TRAVEL_BREAKPOINTS,
  CIRCLE_TRAVEL_VALUES,
  interpolateProgress,
  SPREAD_BREAKPOINTS,
  SPREAD_MARGIN_PX,
  SPREAD_OFFSET,
} from "./serviceReveal";
import { PATH_HORIZONTAL, PATH_VERTICAL } from "./pathConfig";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  EMPTY_LAYOUT_CACHE,
  measureLayoutCache,
  measurePathEndpointsFromDom,
  type LayoutCache,
} from "./circleLayoutCache";
import { placeCircles, type CircleModel } from "./placeCircles";
import type {
  InstanceInput,
  LogoSpec,
  ThreeCircleField,
} from "./threeCircleField";

const CIRCLE_LOGOS: LogoSpec[] = [
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

const PATH_CIRCLE_CURSOR = 9;
const PATH_CIRCLE_NEXTJS = 14;

const BOX_COUNT = 9;
const HERO_COUNT = 13;

function buildMobileHeroSlots(count: number): { x: number; y: number }[] {
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

const MOBILE_HERO_SLOTS = buildMobileHeroSlots(HERO_COUNT);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCircles(): CircleModel[] {
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

function logoScaleForWidth(w: number) {
  if (w < 480) return 0.72;
  if (w < 768) return 0.78;
  if (w < 1024) return 0.8;
  return 1;
}

function detectWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

type Backend = "three" | "dom";

export default function CircleField({
  servicesRef,
  boxRef,
  svgRef,
  pathSectionRef,
  logosLandedProgress,
}: {
  servicesRef: RefObject<HTMLElement | null>;
  boxRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  pathSectionRef: RefObject<HTMLElement | null>;
  logosLandedProgress: MotionValue<number>;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const visibleRef = useRef(true);
  const viewportRef = useRef({ w: 1, h: 1 });
  const revealedRef = useRef(false);
  const maxVisibleRef = useRef(CIRCLE_LOGOS.length);
  const landedRef = useRef(false);
  const frameTimeRef = useRef(0);
  const layoutRef = useRef<LayoutCache>(EMPTY_LAYOUT_CACHE);
  const isDesktopRef = useRef(false);
  const sizesRef = useRef<number[]>(CIRCLE_LOGOS.map((l) => l.size));
  const backendRef = useRef<Backend | null>(null);
  const threeRef = useRef<ThreeCircleField | null>(null);
  const instItemsRef = useRef<InstanceInput[]>(
    CIRCLE_LOGOS.map(() => ({ x: 0, y: 0, size: 0, alpha: 0 })),
  );

  const [backend, setBackend] = useState<Backend | null>(null);

  const reduced = useReducedMotion();
  const circles = useMemo(() => makeCircles(), []);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const pathConfig = isDesktop ? PATH_HORIZONTAL : PATH_VERTICAL;

  useEffect(() => {
    isDesktopRef.current = isDesktop;
  }, [isDesktop]);

  const { scrollYProgress } = useScroll({
    target: servicesRef,
    offset: SPREAD_OFFSET,
  });
  const travel = useTransform(scrollYProgress, (progress) =>
    interpolateProgress(progress, CIRCLE_TRAVEL_BREAKPOINTS, CIRCLE_TRAVEL_VALUES, (t) => t),
  );
  const marginPx = useTransform(scrollYProgress, (progress) =>
    interpolateProgress(progress, SPREAD_BREAKPOINTS, SPREAD_MARGIN_PX),
  );

  useMotionValueEvent(travel, "change", (value) => {
    const landed = value >= 0.98;
    if (landed === landedRef.current) return;
    landedRef.current = landed;
    animate(logosLandedProgress, landed ? 1 : 0, {
      duration: landed ? 0.6 : 0.25,
      ease: "easeOut",
    });
  });

  const { scrollYProgress: pathProgress } = useScroll({
    target: pathSectionRef,
    offset: ["start end", "start start"],
  });
  const pathTravel = useTransform(pathProgress, [0, 1], [0, 1]);

  const remeasure = useCallback(() => {
    const overlay = overlayRef.current;
    const box = boxRef.current;
    if (!overlay || !box) {
      layoutRef.current = EMPTY_LAYOUT_CACHE;
      return;
    }

    layoutRef.current = measureLayoutCache({
      overlay,
      box,
      hero: document.getElementById("hero"),
      svg: svgRef.current,
      pathSection: pathSectionRef.current,
      pathConfig: isDesktopRef.current ? PATH_HORIZONTAL : PATH_VERTICAL,
      marginPx: marginPx.get(),
      isDesktop: isDesktopRef.current,
    });
  }, [boxRef, marginPx, pathSectionRef, svgRef]);

  const computePoses = useCallback(
    (time: number, rest: boolean) => {
      const cache = layoutRef.current;
      if (!cache.valid) return null;

      const pathTravelVal = pathTravel.get();
      const overlay = overlayRef.current;
      const svg = svgRef.current;
      const pathEndpoints =
        pathTravelVal > 0 && overlay && svg
          ? measurePathEndpointsFromDom(
              overlay,
              svg,
              isDesktopRef.current ? PATH_HORIZONTAL : PATH_VERTICAL,
            )
          : null;

      return placeCircles({
        circles,
        cache,
        travel: travel.get(),
        pathTravel: pathTravelVal,
        marginPx: marginPx.get(),
        scrollY: window.scrollY,
        scrollX: window.scrollX,
        viewportW: viewportRef.current.w,
        viewportH: viewportRef.current.h,
        time,
        rest,
        isDesktop: isDesktopRef.current,
        maxVisible: maxVisibleRef.current,
        mobileHeroSlots: MOBILE_HERO_SLOTS,
        boxCount: BOX_COUNT,
        pathEndpoints: pathEndpoints ?? undefined,
      });
    },
    [circles, marginPx, pathTravel, travel, svgRef],
  );

  const paint = useCallback(
    (time: number, rest: boolean) => {
      const poses = computePoses(time, rest);
      if (!poses) return;

      if (backendRef.current === "three") {
        const three = threeRef.current;
        if (!three || !three.ready) return;
        const cache = layoutRef.current;
        const offsetX = cache.overlayDocLeft - window.scrollX;
        const offsetY = cache.overlayDocTop - window.scrollY;
        const sizes = sizesRef.current;
        const items = instItemsRef.current;
        for (let i = 0; i < poses.length; i++) {
          const pose = poses[i];
          const item = items[i];
          item.x = pose.x + offsetX;
          item.y = pose.y + offsetY;
          item.size = sizes[i] ?? CIRCLE_LOGOS[i].size;
          item.alpha = pose.hidden ? 0 : 1;
        }
        three.setInstances(items);
        three.render();
        return;
      }

      // DOM fallback: write transforms directly to the spans.
      const reveal = !revealedRef.current;
      for (let i = 0; i < poses.length; i++) {
        const el = elsRef.current[i];
        if (!el) continue;
        const pose = poses[i];
        if (pose.hidden) {
          el.style.opacity = "0";
          continue;
        }
        el.style.transform = `translate3d(${pose.x}px, ${pose.y}px, 0) translate(-50%, -50%)`;
        if (reveal) el.style.opacity = "1";
      }
      revealedRef.current = true;
    },
    [computePoses],
  );

  const applyLogoSizes = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    viewportRef.current = { w, h };
    const scale = logoScaleForWidth(w);
    maxVisibleRef.current = CIRCLE_LOGOS.length;
    for (let i = 0; i < CIRCLE_LOGOS.length; i++) {
      sizesRef.current[i] = Math.round(CIRCLE_LOGOS[i].size * scale);
    }
    if (backendRef.current !== "dom") return;
    for (let i = 0; i < CIRCLE_LOGOS.length; i++) {
      const el = elsRef.current[i];
      if (!el) continue;
      el.style.width = `${sizesRef.current[i]}px`;
      el.style.height = `${sizesRef.current[i]}px`;
    }
  }, []);

  const syncThreeSize = useCallback(() => {
    const three = threeRef.current;
    const canvas = canvasRef.current;
    if (!three || !canvas) return;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    three.setSize(w, h, window.devicePixelRatio || 1);
  }, []);

  const updateCanvasDisplay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.display =
      backendRef.current === "three" && visibleRef.current ? "block" : "none";
  }, []);

  // Decide the render backend once mounted: Three.js when WebGL is available,
  // otherwise the DOM span fallback. Three is dynamically imported so the
  // library is code-split out of the initial bundle and never runs on the server.
  useEffect(() => {
    let cancelled = false;
    let instance: ThreeCircleField | null = null;

    if (!detectWebGL() || !canvasRef.current) {
      backendRef.current = "dom";
      setBackend("dom");
      return;
    }

    const canvas = canvasRef.current;
    (async () => {
      try {
        const mod = await import("./threeCircleField");
        if (cancelled) return;
        instance = new mod.ThreeCircleField(canvas, CIRCLE_LOGOS);
        const ok = await instance.init();
        if (cancelled || !ok) {
          instance?.dispose();
          instance = null;
          if (!cancelled) {
            backendRef.current = "dom";
            setBackend("dom");
          }
          return;
        }
        threeRef.current = instance;
        backendRef.current = "three";
        if (reduced) {
          instance.setMasterOpacity(1);
        } else {
          instance.setMasterOpacity(0);
          animate(0, 1, {
            duration: 0.5,
            ease: "easeOut",
            onUpdate: (v) => threeRef.current?.setMasterOpacity(v),
          });
        }
        setBackend("three");
      } catch {
        instance?.dispose();
        instance = null;
        if (!cancelled) {
          backendRef.current = "dom";
          setBackend("dom");
        }
      }
    })();

    return () => {
      cancelled = true;
      instance?.dispose();
      threeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial layout + paint once a backend is chosen, and keep in sync on resize.
  useEffect(() => {
    if (backend === null) return;
    applyLogoSizes();
    remeasure();
    syncThreeSize();
    updateCanvasDisplay();
    paint(frameTimeRef.current, Boolean(reduced));

    const onResize = () => {
      applyLogoSizes();
      remeasure();
      syncThreeSize();
      paint(frameTimeRef.current, Boolean(reduced));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [
    applyLogoSizes,
    backend,
    isDesktop,
    paint,
    pathConfig,
    reduced,
    remeasure,
    syncThreeSize,
    updateCanvasDisplay,
  ]);

  // Cold-path: pick up SVG size once it lays out (not on box margin animation).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const ro = new ResizeObserver(() => {
      remeasure();
      if (!visibleRef.current) return;
      paint(frameTimeRef.current, Boolean(reduced));
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, [paint, reduced, remeasure, svgRef, isDesktop]);

  // Single rAF path for all pose updates (scroll + idle drift). Avoids
  // duplicate paint calls from scroll listeners during smooth nav scroll.
  useAnimationFrame((time) => {
    frameTimeRef.current = time;
    if (reduced) return;
    if (!visibleRef.current) return;
    paint(time, false);
  });

  // Reduced motion: no rAF drift, but the fixed Three canvas must still repaint
  // on scroll so resting discs stay glued to their document positions.
  useEffect(() => {
    if (backend !== "three" || !reduced) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (visibleRef.current) paint(0, true);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [backend, paint, reduced]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
        updateCanvasDisplay();
      },
      { threshold: 0 },
    );
    io.observe(overlay);
    return () => io.disconnect();
  }, [updateCanvasDisplay]);

  return (
    <>
      {backend !== "dom" && (
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-20"
          style={{ display: "none" }}
        />
      )}
      <div
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      >
        {backend === "dom" &&
          circles.map((_, i) => (
            <span
              key={i}
              ref={(el) => {
                elsRef.current[i] = el;
              }}
              className="absolute left-0 top-0 overflow-hidden rounded-full will-change-transform"
              style={{
                opacity: 0,
                width: CIRCLE_LOGOS[i].size,
                height: CIRCLE_LOGOS[i].size,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/logos/${CIRCLE_LOGOS[i].file}`}
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
          ))}
      </div>
    </>
  );
}
