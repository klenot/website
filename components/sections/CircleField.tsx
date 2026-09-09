"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import {
  animate,
  useAnimationFrame,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import type { MotionValue } from "motion/react";
import {
  circleTravelFromSpread,
  SPREAD_OFFSET,
  spreadMarginPx,
} from "./serviceReveal";
import { PATH_HORIZONTAL, PATH_VERTICAL } from "./pathConfig";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  EMPTY_LAYOUT_CACHE,
  measureLayoutCache,
  measurePathEndpointsFromDom,
  type LayoutCache,
} from "./circleLayoutCache";
import { placeCircles } from "./placeCircles";
import {
  CIRCLE_LOGOS,
  BOX_COUNT,
  MOBILE_HERO_SLOTS,
  makeCircles,
  logoScaleForWidth,
} from "./circleFieldModel";

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
  const elsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const visibleRef = useRef(true);
  const viewportRef = useRef({ w: 1, h: 1 });
  const revealedRef = useRef(false);
  const maxVisibleRef = useRef(CIRCLE_LOGOS.length);
  const landedRef = useRef(false);
  const frameTimeRef = useRef(0);
  const layoutRef = useRef<LayoutCache>(EMPTY_LAYOUT_CACHE);
  const isDesktopRef = useRef(false);

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
  const travel = useTransform(scrollYProgress, circleTravelFromSpread);

  const widthMV = useMotionValue(0);
  useEffect(() => {
    const measure = () =>
      widthMV.set(overlayRef.current?.clientWidth ?? window.innerWidth);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [widthMV]);

  const marginPx = useTransform([scrollYProgress, widthMV], ([progress, width]) =>
    spreadMarginPx(progress as number, width as number),
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

  const applyPoses = useCallback(
    (time: number, rest: boolean) => {
      const cache = layoutRef.current;
      if (!cache.valid) return;

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

      const poses = placeCircles({
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
    [circles, marginPx, pathTravel, travel],
  );

  const applyLogoSizes = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    viewportRef.current = { w, h };
    const scale = logoScaleForWidth(w);
    maxVisibleRef.current = CIRCLE_LOGOS.length;
    for (let i = 0; i < CIRCLE_LOGOS.length; i++) {
      const el = elsRef.current[i];
      if (!el) continue;
      const s = Math.round(CIRCLE_LOGOS[i].size * scale);
      el.style.width = `${s}px`;
      el.style.height = `${s}px`;
    }
  }, []);

  useEffect(() => {
    applyLogoSizes();
    remeasure();
    applyPoses(0, Boolean(reduced));

    const onResize = () => {
      applyLogoSizes();
      remeasure();
      applyPoses(frameTimeRef.current, Boolean(reduced));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [applyLogoSizes, applyPoses, reduced, remeasure, isDesktop, pathConfig]);

  // Cold-path: pick up SVG size once it lays out (not on box margin animation).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const ro = new ResizeObserver(() => {
      remeasure();
      if (!visibleRef.current) return;
      applyPoses(frameTimeRef.current, Boolean(reduced));
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, [applyPoses, reduced, remeasure, svgRef, isDesktop]);

  // Single rAF path for all pose updates (scroll + idle drift). Avoids
  // duplicate applyPoses calls from scroll listeners during smooth nav scroll.
  useAnimationFrame((time) => {
    frameTimeRef.current = time;
    if (reduced) return;
    if (!visibleRef.current) return;
    applyPoses(time, false);
  });

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    io.observe(overlay);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={overlayRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
    >
      {circles.map((_, i) => (
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
  );
}
