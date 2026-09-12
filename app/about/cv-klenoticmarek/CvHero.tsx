"use client";

import Image from "next/image";
import { useLayoutEffect, type ReactNode } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";

const TARGET_PHOTO_PX = 360;
const START_ASPECT = 16 / 9;
const END_ASPECT = 1;
const MORPH_VH = 0.55;
const HOLD_VH = 0.5;

function easeOutQuad(t: number) {
  return 1 - (1 - t) ** 2;
}

function morphDistance() {
  return Math.max(1, window.innerHeight * MORPH_VH);
}

function holdDistance() {
  return Math.max(1, window.innerHeight * HOLD_VH);
}

function lockDistance() {
  return morphDistance() + holdDistance();
}

export default function CvHero({
  nav,
  children,
}: {
  nav?: ReactNode;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const progress = useMotionValue(reduced ? 1 : 0);

  useLayoutEffect(() => {
    if (reduced) {
      progress.set(1);
      return;
    }

    let accumulated = 0;

    const apply = (next: number) => {
      const morph = morphDistance();
      const lock = lockDistance();
      accumulated = Math.min(lock, Math.max(0, next));
      progress.set(easeOutQuad(Math.min(1, accumulated / morph)));
      return accumulated < lock;
    };

    const onWheel = (event: WheelEvent) => {
      if (window.scrollY > 0) {
        progress.set(1);
        accumulated = lockDistance();
        return;
      }

      const lock = lockDistance();
      if (event.deltaY > 0 && accumulated < lock) {
        apply(accumulated + event.deltaY);
        event.preventDefault();
        return;
      }
      if (event.deltaY < 0 && accumulated > 0) {
        apply(accumulated + event.deltaY);
        event.preventDefault();
      }
    };

    let touchY = 0;
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? touchY;
      const delta = touchY - y;
      touchY = y;

      if (window.scrollY > 0) {
        progress.set(1);
        accumulated = lockDistance();
        return;
      }

      const lock = lockDistance();
      if (delta > 0 && accumulated < lock) {
        apply(accumulated + delta);
        event.preventDefault();
        return;
      }
      if (delta < 0 && accumulated > 0) {
        apply(accumulated + delta);
        event.preventDefault();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (window.scrollY > 0) return;
      const lock = lockDistance();
      const step = Math.round(window.innerHeight * 0.12);

      if (
        (event.key === " " ||
          event.key === "PageDown" ||
          event.key === "ArrowDown") &&
        accumulated < lock
      ) {
        apply(accumulated + step);
        event.preventDefault();
      }
      if (
        (event.key === "PageUp" || event.key === "ArrowUp") &&
        accumulated > 0
      ) {
        apply(accumulated - step);
        event.preventDefault();
      }
    };

    const onScroll = () => {
      if (window.scrollY > 0) {
        progress.set(1);
        accumulated = lockDistance();
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, [progress, reduced]);

  const width = useMotionTemplate`calc(100% - (100% - ${TARGET_PHOTO_PX}px) * ${progress})`;
  const aspectRatio = useTransform(
    progress,
    (p) => START_ASPECT + (END_ASPECT - START_ASPECT) * p,
  );

  return (
    <div className="cv-hero-track relative h-[70dvh]">
      <header className="cv-hero-header sticky top-0 flex min-h-[70dvh] w-full flex-col items-center justify-center bg-white text-center">
        {nav ? (
          <div className="absolute inset-x-0 top-5 z-10 text-left">{nav}</div>
        ) : null}

        <span className="mb-5 block font-mono text-[0.6875rem] tracking-wider text-black/50 uppercase">
          Curriculum Vitae
        </span>

        <motion.div
          style={{ width, aspectRatio }}
          className="cv-hero-photo relative mb-6 max-w-full overflow-hidden rounded-md border border-black/10"
        >
          <Image
            src="/about/cv-klenoticmarek/portrait.jpg"
            alt="Portrait of Marek Klenotič wearing a white TALENT INSIDE t-shirt"
            fill
            priority
            className="object-cover object-top"
            sizes="(max-width: 640px) 100vw, 640px"
          />
        </motion.div>

        <h1 className="font-mono text-[1.802rem] font-bold leading-[1.3] tracking-[-0.02em] md:text-[2.25rem]">
          <span className="text-neutral-500">Hi!</span>{" "}
          <span className="text-black">I&apos;m Marek Klenotič.</span>
        </h1>

        <div className="mt-6">{children}</div>
      </header>
    </div>
  );
}
