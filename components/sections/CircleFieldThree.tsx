"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  WebGLRenderer,
  type ShaderMaterial,
  type Texture,
} from "three";
import {
  animate,
  useMotionValue,
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
  SPREAD_OFFSET,
  spreadMarginPx,
} from "./serviceReveal";
import { PATH_HORIZONTAL, PATH_VERTICAL } from "./pathConfig";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  EMPTY_LAYOUT_CACHE,
  measureLayoutCache,
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

/** Quad is larger than the disc so the soft contact shadow has room to bleed. */
const QUAD = 1.5;

type CircleFieldProps = {
  servicesRef: RefObject<HTMLElement | null>;
  boxRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  pathSectionRef: RefObject<HTMLElement | null>;
  logosLandedProgress: MotionValue<number>;
};

type Disc = {
  mesh: Mesh;
  material: ShaderMaterial;
  texture: Texture;
  opacity: number;
};

type Metrics = {
  overlayDocTop: number;
  overlayH: number;
  canvasH: number;
  canvasW: number;
};

export default function CircleFieldThree({
  servicesRef,
  boxRef,
  svgRef,
  pathSectionRef,
  logosLandedProgress,
}: CircleFieldProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<OrthographicCamera | null>(null);
  const discsRef = useRef<Disc[]>([]);
  const metricsRef = useRef<Metrics>({
    overlayDocTop: 0,
    overlayH: 1,
    canvasH: 1,
    canvasW: 1,
  });

  const visibleRef = useRef(false);
  const viewportRef = useRef({ w: 1, h: 1 });
  const revealedRef = useRef(false);
  const landedRef = useRef(false);
  const frameTimeRef = useRef(0);
  const layoutRef = useRef<LayoutCache>(EMPTY_LAYOUT_CACHE);
  const isDesktopRef = useRef(false);

  // rAF controller state (dirty-flag loop — no always-on idle rendering).
  const runningRef = useRef(false);
  const rafRef = useRef(0);
  const staticRafRef = useRef(0);
  const reducedRef = useRef(false);

  const reduced = useReducedMotion();
  const circles = useMemo(() => makeCircles(), []);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const pathConfig = isDesktop ? PATH_HORIZONTAL : PATH_VERTICAL;

  useEffect(() => {
    isDesktopRef.current = isDesktop;
  }, [isDesktop]);
  useEffect(() => {
    reducedRef.current = Boolean(reduced);
  }, [reduced]);

  const { scrollYProgress } = useScroll({
    target: servicesRef,
    offset: SPREAD_OFFSET,
  });
  const travel = useTransform(scrollYProgress, (progress) =>
    interpolateProgress(progress, CIRCLE_TRAVEL_BREAKPOINTS, CIRCLE_TRAVEL_VALUES),
  );

  const widthMV = useMotionValue(0);
  const marginPx = useTransform([scrollYProgress, widthMV], ([progress, width]) =>
    spreadMarginPx(progress as number, width as number),
  );

  const { scrollYProgress: pathProgress } = useScroll({
    target: pathSectionRef,
    offset: ["start end", "start start"],
  });
  const pathTravel = useTransform(pathProgress, [0, 1], [0, 1]);

  const updateMetrics = useCallback(() => {
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !canvas) return;
    const oRect = overlay.getBoundingClientRect();
    metricsRef.current = {
      overlayDocTop: oRect.top + window.scrollY,
      overlayH: oRect.height,
      canvasH: Math.max(1, canvas.clientHeight),
      canvasW: Math.max(1, canvas.clientWidth),
    };
    widthMV.set(oRect.width);
  }, [widthMV]);

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
    updateMetrics();
  }, [boxRef, marginPx, pathSectionRef, svgRef, updateMetrics]);

  // Renders one frame. `rest` = static resting pose (reduced motion / offscreen
  // seed). Overlay→canvas mapping is derived from cached metrics + scrollY only
  // (no per-frame getBoundingClientRect).
  const applyPoses = useCallback(
    (time: number, rest: boolean) => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) return;

      const cache = layoutRef.current;
      const discs = discsRef.current;
      const smoothing = rest ? 1 : 0.16;

      if (!cache.valid) {
        for (const d of discs) {
          d.opacity += (0 - d.opacity) * smoothing;
          d.material.uniforms.uOpacity.value = d.opacity;
          d.mesh.visible = d.opacity > 0.001;
        }
        renderer.render(scene, camera);
        return;
      }

      const { overlayDocTop, overlayH, canvasH } = metricsRef.current;
      const scrollY = window.scrollY;
      const overlayTopVp = overlayDocTop - scrollY;
      // Sticky (top:0) canvas offset within the overlay, closed-form: no layout
      // reads. offX is 0 because the canvas is left:0 / full width of overlay.
      const clampMax = Math.max(0, overlayH - canvasH);
      const offY = -Math.min(Math.max(-overlayTopVp, 0), clampMax);

      const poses = placeCircles({
        circles,
        cache,
        travel: travel.get(),
        pathTravel: pathTravel.get(),
        marginPx: marginPx.get(),
        scrollY,
        scrollX: window.scrollX,
        viewportW: viewportRef.current.w,
        viewportH: viewportRef.current.h,
        time,
        rest,
        isDesktop: isDesktopRef.current,
        maxVisible: CIRCLE_LOGOS.length,
        mobileHeroSlots: MOBILE_HERO_SLOTS,
        boxCount: BOX_COUNT,
      });

      const reveal = !revealedRef.current;
      const scale = logoScaleForWidth(viewportRef.current.w);

      for (let i = 0; i < discs.length; i++) {
        const d = discs[i];
        const pose = poses[i];
        const target = pose.hidden ? 0 : 1;

        if (reveal && !pose.hidden) d.opacity = rest ? 1 : 0;
        d.opacity += (target - d.opacity) * smoothing;
        d.material.uniforms.uOpacity.value = d.opacity;

        if (d.opacity <= 0.001) {
          d.mesh.visible = false;
          continue;
        }
        d.mesh.visible = true;

        d.mesh.position.x = pose.x;
        d.mesh.position.y = canvasH - (pose.y + offY); // ortho origin bottom-left

        const c = circles[i];
        const lift = rest
          ? 0.35
          : 0.5 + 0.5 * Math.sin(time * (c.fx + 0.0002) + c.phase);
        d.material.uniforms.uLift.value = lift;

        const breathe = rest ? 1 : 1 + Math.sin(time * (c.fy + 0.0002) + c.phase) * 0.015;
        const quad = CIRCLE_LOGOS[i].size * scale * breathe * QUAD;
        d.mesh.scale.set(quad, quad, 1);
        d.mesh.renderOrder = Math.round(CIRCLE_LOGOS[i].size + lift * 4);
      }

      revealedRef.current = true;
      renderer.render(scene, camera);
    },
    [circles, marginPx, pathTravel, travel],
  );

  const resize = useCallback(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !camera || !canvas) return;

    updateMetrics();
    const { canvasW: w, canvasH: h } = metricsRef.current;
    viewportRef.current = { w: window.innerWidth, h: window.innerHeight };

    // Mobile knobs: cap DPR harder on narrow viewports to keep fill-rate low.
    const narrow = window.innerWidth < 768;
    const dpr = Math.min(window.devicePixelRatio || 1, narrow ? 1.25 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);

    camera.left = 0;
    camera.right = w;
    camera.top = h;
    camera.bottom = 0;
    camera.updateProjectionMatrix();
  }, [updateMetrics]);

  // --- rAF controller: only runs while visible + tab foregrounded; reduced
  // motion never spins a continuous loop (renders on demand instead). ---
  // applyPoses changes identity with its deps; the loop reads it via a ref so
  // the running rAF chain never needs to be torn down / recreated.
  const applyPosesRef = useRef(applyPoses);
  useEffect(() => {
    applyPosesRef.current = applyPoses;
  }, [applyPoses]);

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const startLoop = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    const tick = (time: number) => {
      if (!runningRef.current) return;
      frameTimeRef.current = time;
      applyPosesRef.current(time, false);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const renderStatic = useCallback((rest: boolean) => {
    if (staticRafRef.current) return;
    staticRafRef.current = requestAnimationFrame((time) => {
      staticRafRef.current = 0;
      frameTimeRef.current = time;
      applyPosesRef.current(time, rest);
    });
  }, []);

  const syncActive = useCallback(() => {
    const active =
      visibleRef.current &&
      (typeof document === "undefined" || document.visibilityState !== "hidden");

    if (reducedRef.current) {
      stopLoop();
      if (active) renderStatic(true);
      return;
    }
    if (active) startLoop();
    else stopLoop();
  }, [renderStatic, startLoop, stopLoop]);

  // Scene setup / teardown.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const narrow = window.innerWidth < 768;
    const renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !narrow, // shader already AAs the disc edge; skip MSAA on mobile
      premultipliedAlpha: false,
      powerPreference: narrow ? "low-power" : "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    if ("outputColorSpace" in renderer) {
      renderer.outputColorSpace = SRGBColorSpace;
    }
    rendererRef.current = renderer;

    const scene = new Scene();
    sceneRef.current = scene;

    const camera = new OrthographicCamera(0, 1, 1, 0, -1000, 1000);
    camera.position.z = 10;
    cameraRef.current = camera;

    const geometry = new PlaneGeometry(1, 1);
    const loader = new TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const discs: Disc[] = CIRCLE_LOGOS.map((logo) => {
      const texture = loader.load(`/logos/${logo.file}`, () => {
        // Draw as textures arrive so the field doesn't pop in blank.
        renderStatic(reducedRef.current);
      });
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = maxAniso;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.magFilter = LinearFilter;
      texture.wrapS = ClampToEdgeWrapping;
      texture.wrapT = ClampToEdgeWrapping;
      texture.generateMipmaps = true;

      const material = createDiscMaterial(texture);
      material.uniforms.uDiscFrac.value = 1 / QUAD;

      const mesh = new Mesh(geometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);

      return { mesh, material, texture, opacity: 0 };
    });
    discsRef.current = discs;

    resize();
    remeasure();
    revealedRef.current = false;
    applyPoses(0, reducedRef.current);

    return () => {
      stopLoop();
      if (staticRafRef.current) cancelAnimationFrame(staticRafRef.current);
      staticRafRef.current = 0;
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

  // Resize + remeasure on viewport / breakpoint changes.
  useEffect(() => {
    resize();
    remeasure();
    syncActive();
    if (!runningRef.current) renderStatic(reducedRef.current);

    const onResize = () => {
      resize();
      remeasure();
      if (!runningRef.current) renderStatic(reducedRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [remeasure, renderStatic, resize, syncActive, isDesktop, pathConfig, reduced]);

  // Pick up the SVG's late layout (path section) without churning on the box
  // margin animation.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ro = new ResizeObserver(() => {
      remeasure();
      if (!runningRef.current) renderStatic(reducedRef.current);
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, [remeasure, renderStatic, svgRef, isDesktop]);

  useMotionValueEvent(travel, "change", (value) => {
    const landed = value >= 0.98;
    if (landed !== landedRef.current) {
      landedRef.current = landed;
      animate(logosLandedProgress, landed ? 1 : 0, {
        duration: landed ? 0.6 : 0.25,
        ease: "easeOut",
      });
    }
    // Reduced motion has no continuous loop: nudge a static frame so the box
    // circles still track the scrubbed box on wake.
    if (reducedRef.current && visibleRef.current) renderStatic(true);
  });

  // Wake the loop / static render on scroll even when metrics say we're pinned;
  // the closed-form offset needs a fresh scrollY, and reduced motion relies on
  // this to stay glued to the page.
  useEffect(() => {
    const onScroll = () => {
      if (reducedRef.current) {
        if (visibleRef.current) renderStatic(true);
      } else if (visibleRef.current && !runningRef.current) {
        syncActive();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [renderStatic, syncActive]);

  // Visibility (offscreen) + tab-hidden gating.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
        syncActive();
      },
      { threshold: 0, rootMargin: "10% 0px" },
    );
    io.observe(overlay);

    const onVisibility = () => syncActive();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [syncActive]);

  return (
    <div ref={overlayRef} aria-hidden className="pointer-events-none absolute inset-0 z-20">
      <canvas
        ref={canvasRef}
        className="sticky left-0 top-0 block h-screen w-full"
      />
    </div>
  );
}
