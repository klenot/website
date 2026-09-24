"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { MotionValue } from "motion/react";
import { motion, useMotionValue, useScroll, useTransform } from "motion/react";
import {
  interpolateProgress,
  SPREAD_OFFSET,
  spreadLayoutMarginPx,
  spreadScale,
} from "./serviceReveal";

export default function Services({
  sectionRef,
  boxRef,
  logosLandedProgress,
}: {
  sectionRef?: RefObject<HTMLElement | null>;
  boxRef?: RefObject<HTMLDivElement | null>;
  logosLandedProgress: MotionValue<number>;
}) {
  const internalRef = useRef<HTMLElement>(null);
  const ref = sectionRef ?? internalRef;

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: SPREAD_OFFSET,
  });

  // Live container width feeds the responsive inset so the box starts
  // noticeably narrow and spreads to full-bleed on every screen size.
  const widthMV = useMotionValue(0);
  useEffect(() => {
    const measure = () =>
      widthMV.set(ref.current?.offsetWidth ?? window.innerWidth);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ref, widthMV]);

  // Laid out once at full spread; the stretch/shrink is a transform scale on
  // the compositor, so scrolling never reflows the page (it used to animate
  // margins, which re-laid-out everything below the box every frame).
  const layoutMargin = useTransform(widthMV, (width) => `${spreadLayoutMarginPx(width)}px`);
  const scale = useTransform([scrollYProgress, widthMV], ([progress, width]) =>
    spreadScale(progress as number, width as number),
  );

  const borderRadius = useTransform([scrollYProgress, scale], ([progress, s]) => {
    // Stay rounded even at max spread so it always reads as the services card.
    const px = interpolateProgress(progress as number, [0.25, 0.35, 0.8, 0.9], [24, 14, 14, 24]);
    // Counter the scale so the on-screen radius is unchanged.
    return `${px / Math.max(0.01, s as number)}px`;
  });

  const textExitOpacity = useTransform(
    scrollYProgress,
    [0, 0.72, 0.78, 1],
    [1, 1, 0, 0],
  );

  const textOpacity = useTransform(
    [logosLandedProgress, textExitOpacity],
    ([landed, exit]) => (landed as number) * (exit as number),
  );

  return (
    <section ref={ref} id="services" className="pb-[15vh] pt-4">
      <motion.div
        ref={boxRef}
        style={{
          marginLeft: layoutMargin,
          marginRight: layoutMargin,
          scale,
          originY: 0,
          borderRadius,
          willChange: "transform",
        }}
        className="relative aspect-[9/16] overflow-hidden bg-black md:aspect-video"
      >
        {/* Inner-only top volume — inset shadow, no exterior glow line at the lip. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 rounded-[inherit]"
          style={{
            boxShadow:
              "inset 0 52px 72px -36px rgba(0,0,0,0.62), inset 0 18px 28px -14px rgba(0,0,0,0.28)",
          }}
        />
        <motion.p
          style={{ opacity: textOpacity }}
          className="absolute inset-x-0 bottom-6 px-6 text-center font-mono text-white md:bottom-8"
        >
          Today&apos;s digital space is made for people of many talents.
        </motion.p>
      </motion.div>
    </section>
  );
}
