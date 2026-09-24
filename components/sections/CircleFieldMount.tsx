"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import dynamic from "next/dynamic";
import type { MotionValue } from "motion/react";

// Two separate client chunks. Whichever we render is the only one fetched, so a
// no-WebGL device never downloads `three` (it loads the DOM CircleField chunk),
// and neither is fetched until the field is gated into view below.
const CircleFieldThree = dynamic(() => import("./CircleFieldThree"), { ssr: false });
const CircleFieldDom = dynamic(() => import("./CircleField"), { ssr: false });

type CircleFieldProps = {
  servicesRef: RefObject<HTMLElement | null>;
  boxRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  pathSectionRef: RefObject<HTMLElement | null>;
  logosLandedProgress: MotionValue<number>;
};

function detectWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl")),
    );
  } catch {
    return false;
  }
}

export default function CircleFieldMount(props: CircleFieldProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [renderer, setRenderer] = useState<null | "three" | "dom">(null);

  useEffect(() => {
    const decide = () => setRenderer(detectWebGL() ? "three" : "dom");

    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      decide();
      return;
    }

    // IO-gated: defer picking (and thus importing) the renderer until the field
    // is near the viewport.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          decide();
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (renderer === "three") return <CircleFieldThree {...props} />;
  if (renderer === "dom") return <CircleFieldDom {...props} />;

  return (
    <div
      ref={sentinelRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20"
    />
  );
}
