"use client";

import { useRef } from "react";
import { useMotionValue } from "motion/react";
import HeroServices from "./HeroServices";
import PathAnimation from "./PathAnimation";
// Thin selector: WebGL detection + IO-gated dynamic import. `three` is only
// fetched when the WebGL path is chosen and scrolled near view; no-WebGL loads
// the DOM CircleField chunk instead.
import CircleField from "./CircleFieldMount";

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
