"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import * as THREE from "three";
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
import {
  BOX_COUNT,
  CIRCLE_LOGOS,
  MOBILE_HERO_SLOTS,
  logoScaleForWidth,
  makeCircles,
  placeCircles,
} from "./circleFieldModel";
import { createDiscMaterial } from "./circleDiscMaterial";
import CircleField from "./CircleField";

/** Quad is larger than the disc so the soft contact shadow has room to bleed. */
const QUAD = 1.5;

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

type Disc = {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  texture: THREE.Texture;
  opacity: number;
};

export default function CircleFieldThree(props: CircleFieldProps) {
  const [supported] = useState(detectWebGL);

  if (!supported) {
    // No WebGL: fall back to the proven DOM/motion renderer.
    return <CircleField {...props} />;
  }

  return <CircleFieldThreeCanvas {...props} />;
}

function CircleFieldThreeCanvas({
  servicesRef,
  boxRef,
  svgRef,
  pathSectionRef,
  logosLandedProgress,
}: CircleFieldProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const discsRef = useRef<Disc[]>([]);
  const canvasSizeRef = useRef({ w: 1, h: 1 });

  const visibleRef = useRef(true);
  const viewportRef = useRef({ w: 1, h: 1 });
  const revealedRef = useRef(false);
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

  const applyPoses = useCallback(
    (time: number, rest: boolean) => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const canvas = canvasRef.current;
      const overlay = overlayRef.current;
      if (!renderer || !scene || !camera || !canvas || !overlay) return;

      const cache = layoutRef.current;
      const discs = discsRef.current;

      // Map overlay-local pose coordinates into the sticky (viewport-tall)
      // canvas: one rect read each for overlay + canvas, no interleaved writes.
      const oRect = overlay.getBoundingClientRect();
      const cRect = canvas.getBoundingClientRect();
      const offX = oRect.left - cRect.left;
      const offY = oRect.top - cRect.top;
      const cH = canvasSizeRef.current.h;

      const smoothing = rest ? 1 : 0.16;

      if (!cache.valid) {
        for (let i = 0; i < discs.length; i++) {
          const d = discs[i];
          d.opacity += (0 - d.opacity) * smoothing;
          d.material.uniforms.uOpacity.value = d.opacity;
          d.mesh.visible = d.opacity > 0.001;
        }
        renderer.render(scene, camera);
        return;
      }

      const svg = svgRef.current;
      const pathTravelVal = pathTravel.get();
      const pathEndpoints =
        pathTravelVal > 0 && svg
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
        maxVisible: CIRCLE_LOGOS.length,
        mobileHeroSlots: MOBILE_HERO_SLOTS,
        boxCount: BOX_COUNT,
        pathEndpoints: pathEndpoints ?? undefined,
      });

      const reveal = !revealedRef.current;
      const scale = logoScaleForWidth(viewportRef.current.w);

      for (let i = 0; i < discs.length; i++) {
        const d = discs[i];
        const pose = poses[i];
        const target = pose.hidden ? 0 : 1;

        if (reveal && !pose.hidden) {
          d.opacity = rest ? 1 : 0;
        }
        d.opacity += (target - d.opacity) * smoothing;
        d.material.uniforms.uOpacity.value = d.opacity;

        if (d.opacity <= 0.001) {
          d.mesh.visible = false;
          continue;
        }
        d.mesh.visible = true;

        const px = pose.x + offX;
        const py = pose.y + offY;
        d.mesh.position.x = px;
        d.mesh.position.y = cH - py; // ortho origin is bottom-left

        // subtle floating "height": gentle shadow + rim breathing (no xy drift)
        const c = circles[i];
        const lift = rest ? 0.35 : 0.5 + 0.5 * Math.sin(time * (c.fx + 0.0002) + c.phase);
        d.material.uniforms.uLift.value = lift;

        const breathe = rest ? 1 : 1 + Math.sin(time * (c.fy + 0.0002) + c.phase) * 0.015;
        const size = CIRCLE_LOGOS[i].size * scale * breathe;
        const quad = size * QUAD;
        d.mesh.scale.set(quad, quad, 1);
        d.mesh.renderOrder = Math.round(CIRCLE_LOGOS[i].size + lift * 4);
      }

      revealedRef.current = true;
      renderer.render(scene, camera);
    },
    [circles, marginPx, pathTravel, svgRef, travel],
  );

  const resize = useCallback(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !camera || !canvas) return;

    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    canvasSizeRef.current = { w, h };
    viewportRef.current = { w: window.innerWidth, h: window.innerHeight };

    const dpr = Math.min(
      window.devicePixelRatio || 1,
      isDesktopRef.current ? 2 : 1.5,
    );
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);

    camera.left = 0;
    camera.right = w;
    camera.top = h;
    camera.bottom = 0;
    camera.updateProjectionMatrix();
  }, []);

  // Scene setup / teardown.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    if ("outputColorSpace" in renderer) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1000, 1000);
    camera.position.z = 10;
    cameraRef.current = camera;

    const geometry = new THREE.PlaneGeometry(1, 1);
    const loader = new THREE.TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const discs: Disc[] = CIRCLE_LOGOS.map((logo) => {
      const texture = loader.load(`/logos/${logo.file}`, () => {
        // Draw as textures arrive so the field doesn't pop in blank.
        if (visibleRef.current) applyPoses(frameTimeRef.current, Boolean(reduced));
      });
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = maxAniso;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.generateMipmaps = true;

      const material = createDiscMaterial(texture);
      material.uniforms.uDiscFrac.value = 1 / QUAD;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);

      return { mesh, material, texture, opacity: 0 };
    });
    discsRef.current = discs;

    resize();
    remeasure();
    revealedRef.current = false;
    applyPoses(0, Boolean(reduced));

    return () => {
      for (const d of discs) {
        scene.remove(d.mesh);
        d.material.dispose();
        d.texture.dispose();
      }
      geometry.dispose();
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      discsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resize + remeasure on viewport changes and desktop/mobile switches.
  useEffect(() => {
    resize();
    remeasure();
    applyPoses(frameTimeRef.current, Boolean(reduced));

    const onResize = () => {
      resize();
      remeasure();
      applyPoses(frameTimeRef.current, Boolean(reduced));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [applyPoses, reduced, remeasure, resize, isDesktop, pathConfig]);

  // Pick up the SVG's late layout (path section) without churning on the box
  // margin animation.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ro = new ResizeObserver(() => {
      remeasure();
      if (visibleRef.current) applyPoses(frameTimeRef.current, Boolean(reduced));
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, [applyPoses, reduced, remeasure, svgRef, isDesktop]);

  // Continuous drift + scrubbed travel (skipped for reduced motion).
  useAnimationFrame((time) => {
    frameTimeRef.current = time;
    if (reduced) return;
    if (!visibleRef.current) return;
    applyPoses(time, false);
  });

  // Reduced motion: keep discs glued to their document positions as the sticky
  // canvas scrolls, but never drift or scrub.
  useEffect(() => {
    if (!reduced) return;
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        applyPoses(0, true);
      });
    };
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [applyPoses, reduced]);

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
    <div ref={overlayRef} aria-hidden className="pointer-events-none absolute inset-0 z-20">
      <canvas
        ref={canvasRef}
        className="sticky left-0 top-0 block h-screen w-full"
      />
    </div>
  );
}
