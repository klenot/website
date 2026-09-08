"use client";

import { useRef } from "react";
import { useMotionValue } from "motion/react";
import dynamic from "next/dynamic";
import HeroServices from "./HeroServices";
import PathAnimation from "./PathAnimation";

// WebGL logo field is client-only (owns a canvas + Three.js scene). It falls
// back to the DOM/motion renderer internally when WebGL is unavailable.
const CircleField = dynamic(() => import("./CircleFieldThree"), { ssr: false });

export default function HeroServicesPath() {
  const servicesRef = useRef<HTMLElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathSectionRef = useRef<HTMLElement>(null);
  const logosLandedProgress = useMotionValue(0);

  return (
    <div className="relative">
      <CircleField
        servicesRef={servicesRef}
        boxRef={boxRef}
        svgRef={svgRef}
        pathSectionRef={pathSectionRef}
        logosLandedProgress={logosLandedProgress}
      />
      <HeroServices
        servicesRef={servicesRef}
        boxRef={boxRef}
        logosLandedProgress={logosLandedProgress}
      />
      <PathAnimation svgRef={svgRef} sectionRef={pathSectionRef} />
    </div>
  );
}
