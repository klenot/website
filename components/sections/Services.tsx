"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { MotionValue } from "motion/react";
import { motion, useMotionValue, useScroll, useTransform } from "motion/react";
import { interpolateProgress, SPREAD_OFFSET, spreadMarginPx } from "./serviceReveal";

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

  const marginX = useTransform(
    [scrollYProgress, widthMV],
    ([progress, width]) => `${spreadMarginPx(progress as number, width as number)}px`,
  );

  const borderRadius = useTransform(scrollYProgress, (progress) => {
    // Stay rounded even at max spread so it always reads as the services card.
    const px = interpolateProgress(progress, [0.25, 0.35, 0.8, 0.9], [24, 14, 14, 24]);
    return `${px}px`;
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
        style={{ marginLeft: marginX, marginRight: marginX, borderRadius }}
        className="relative aspect-[9/16] overflow-hidden bg-black md:aspect-video"
      >
        {/* Soft inner top shade — inside the card only, no exterior glow line. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[32%] bg-linear-to-b from-black/55 via-black/20 to-transparent"
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
