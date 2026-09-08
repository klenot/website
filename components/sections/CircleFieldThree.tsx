"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import {
  type Light,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  WebGLRenderer,
  type Mesh,
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
import {
  createCoin,
  createCoinGeometry,
  createCoinMaterials,
  createLights,
  createShadow,
  createShadowTexture,
  type Coin,
  type CoinGeometry,
  type CoinMaterials,
} from "./coinFactory";

const FOV = 30;
// Small per-tier z only for correct-sorted overlaps; visible near/far comes from
// a baked SIZE multiplier (below), so landing stays pixel-exact.
const Z_SORT = 60;
const HERO_LIFT = 80; // chips float a little in front while up in the hero

// Idle stop: after this long with no scroll/resize/IO wake, drift eases to 0
// over the decay window and the rAF loop halts until the next wake.
const IDLE_HOLD_MS = 220;
const IDLE_DECAY_MS = 900;

const smoother = (t: number) => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * c * (c * (c * 6 - 15) + 10);
};
const gauss = (x: number, mu: number, sigma: number) => {
  const d = (x - mu) / sigma;
  return Math.exp(-0.5 * d * d);
};

type CircleFieldProps = {
  servicesRef: RefObject<HTMLElement | null>;
  boxRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  pathSectionRef: RefObject<HTMLElement | null>;
  logosLandedProgress: MotionValue<number>;
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
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const camDistRef = useRef(1000);
  const coinsRef = useRef<Coin[]>([]);
  const shadowsRef = useRef<Mesh[]>([]);
  const appearRef = useRef<number[]>([]);
  const geoRef = useRef<CoinGeometry | null>(null);
  const matsRef = useRef<CoinMaterials | null>(null);
  const lightsRef = useRef<Light[]>([]);

  const metricsRef = useRef<Metrics>({
    overlayDocTop: 0,
    overlayH: 1,
    canvasH: 1,
    canvasW: 1,
  });

  const visibleRef = useRef(false);
  const viewportRef = useRef({ w: 1, h: 1 });
  const landedRef = useRef(false);
  const layoutRef = useRef<LayoutCache>(EMPTY_LAYOUT_CACHE);
  const isDesktopRef = useRef(false);
  const mobileRef = useRef(false);
  const maxVisibleRef = useRef(CIRCLE_LOGOS.length);

  const runningRef = useRef(false);
  const rafRef = useRef(0);
  const staticRafRef = useRef(0);
  const reducedRef = useRef(false);
  // Idle-activity: 1 right after a wake, decays to 0 when settled (then the
  // loop stops). Drives drift amplitude so the stop is smooth, not a snap.
  const activityRef = useRef(1);
  const lastWakeRef = useRef(0);
  const lastFrameRef = useRef(0);

  const reduced = useReducedMotion();
  const circles = useMemo(() => makeCircles(), []);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const pathConfig = isDesktop ? PATH_HORIZONTAL : PATH_VERTICAL;

  useEffect(() => {
    isDesktopRef.current = isDesktop;
  }, [isDesktop]);
  useEffect(() => {
    reducedRef.current = Boolean(reduced);
    // Reduced motion renders the settled arrangement (coins gathered in the
    // box); pin the copy so it's visible in that static frame.
    if (reduced) logosLandedProgress.set(1);
  }, [reduced, logosLandedProgress]);

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

  const applyPoses = useCallback(
    (time: number, rest: boolean) => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) return;

      const cache = layoutRef.current;
      const coins = coinsRef.current;
      const shadows = shadowsRef.current;
      const appear = appearRef.current;
      const camDist = camDistRef.current;

      if (!cache.valid) {
        renderer.render(scene, camera);
        return;
      }

      const { overlayH, canvasH, canvasW } = metricsRef.current;
      const scrollY = window.scrollY;
      const overlayTopVp = metricsRef.current.overlayDocTop - scrollY;
      const clampMax = Math.max(0, overlayH - canvasH);
      const offY = -Math.min(Math.max(-overlayTopVp, 0), clampMax);

      // Reduced motion: freeze at the settled (landed) arrangement, no drift.
      const tv = rest ? 1 : travel.get();
      const ptv = rest ? 0 : pathTravel.get();
      const frameTime = rest ? 0 : time;
      const mgn = marginPx.get();
      const mobile = mobileRef.current;

      // Idle activity drives all drift; on mobile idle micro-motion is disabled
      // entirely (dock/tilt for the handoff still play).
      const activity = rest ? 0 : activityRef.current;
      const idle = mobile ? 0 : activity;

      const poses = placeCircles({
        circles,
        cache,
        travel: tv,
        pathTravel: ptv,
        marginPx: mgn,
        scrollY,
        scrollX: window.scrollX,
        viewportW: viewportRef.current.w,
        viewportH: viewportRef.current.h,
        time: frameTime,
        rest: false,
        isDesktop: isDesktopRef.current,
        maxVisible: maxVisibleRef.current,
        mobileHeroSlots: MOBILE_HERO_SLOTS,
        boxCount: BOX_COUNT,
        driftScale: idle,
      });

      const scale = logoScaleForWidth(viewportRef.current.w);
      const dockEase = smoother(tv);

      for (let i = 0; i < coins.length; i++) {
        const coin = coins[i];
        const shadow = shadows[i];
        const pose = poses[i];
        const c = circles[i];

        if (pose.hidden) {
          coin.group.visible = false;
          shadow.visible = false;
          continue;
        }

        const tier = c.depthTier ?? 0.5;
        const nearF = 1 - tier;

        // Appear (scale-in) reveal — avoids toggling opacity on opaque coins.
        const ap = rest ? 1 : Math.min(1, appear[i] + 0.08);
        appear[i] = ap;
        const apEase = ap * ap * (3 - 2 * ap);

        // Depth is a small sort offset only (near in front for correct overlap);
        // no occluder, so chips always render cleanly over the box — never stuck
        // behind a fake line.
        const zSort = (nearF - 0.5) * Z_SORT;
        const zHero = HERO_LIFT + nearF * 30;
        let zc = c.origin === "box" ? zSort : zHero + (zSort - zHero) * dockEase;
        zc += Math.sin(frameTime * 0.0004 * (0.55 + nearF) + c.phase) * 6 * nearF * idle;

        // --- depth-scaled scroll differential (near leads the dock, far lags) ---
        const lead = c.origin === "box" ? 0 : (nearF - 0.5) * 26 * gauss(tv, 0.5, 0.2);

        // --- screen anchor (overlay-local px -> world, y-up) + idle parallax ---
        const idleT = frameTime * (0.55 + nearF * 0.9); // far drifts slower
        const parAmp = (0.4 + nearF) * 4 * idle;
        const worldScreenX =
          pose.x + Math.sin(idleT * (c.fx ?? 0.0005) + (c.spinPhase ?? 0)) * parAmp;
        const worldScreenY =
          canvasH -
          (pose.y +
            offY +
            lead +
            Math.cos(idleT * (c.fy ?? 0.0005) + (c.spinPhase ?? 0)) * parAmp * 0.7);

        // Keep the projected center locked to the target px; visible near/far
        // scale is a baked multiplier so landing never drifts with depth.
        const f = (camDist - zc) / camDist;
        const worldX = canvasW / 2 + (worldScreenX - canvasW / 2) * f;
        const worldY = canvasH / 2 + (worldScreenY - canvasH / 2) * f;
        const sizeMul = 1 + (nearF - 0.5) * 0.34; // clearer near/far scale
        const settle = c.origin === "box" ? 1 : 1 + (1 - dockEase) * 0.06;
        const screenR = (CIRCLE_LOGOS[i].size * scale * sizeMul * settle) / 2;
        const worldR = screenR * f * apEase;

        coin.group.visible = apEase > 0.01;
        coin.group.position.set(worldX, worldY, zc);
        coin.group.scale.setScalar(Math.max(0.0001, worldR));

        // --- tilt + depth-scaled idle micro-yaw + a gentle lean while docking ---
        const tipIn = c.origin === "box" ? 0 : gauss(tv, 0.5, 0.24) * 0.26;
        coin.group.rotation.x =
          (c.tiltX ?? 0) +
          tipIn +
          Math.sin(idleT * 0.0006 + (c.spinPhase ?? 0)) * 0.05 * (0.4 + nearF) * idle;
        coin.group.rotation.y =
          (c.tiltY ?? 0) +
          Math.sin(idleT * 0.00052 + (c.spinPhase ?? 0) * 1.3) * 0.09 * (0.4 + nearF) * idle;

        // --- grounded soft contact shadow (desktop only; invisible on black) ---
        if (mobile) {
          shadow.visible = false;
        } else {
          const shMat = shadow.material as { opacity: number };
          shadow.visible = true;
          const shScale = screenR * f * 2 * 1.5;
          shadow.position.set(worldX, worldY - worldR * 0.5, zc - 6);
          shadow.scale.set(shScale, shScale, 1);
          shMat.opacity = 0.3 * apEase;
        }
      }

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
    const narrow = window.innerWidth < 768;
    mobileRef.current = narrow;
    maxVisibleRef.current = narrow ? 6 : CIRCLE_LOGOS.length;

    // Lower DPR caps to cut fill-rate (Marek: painfully slow scrolling).
    const dpr = Math.min(window.devicePixelRatio || 1, narrow ? 1.25 : 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);

    const camDist = h / 2 / Math.tan((FOV * Math.PI) / 180 / 2);
    camDistRef.current = camDist;
    camera.fov = FOV;
    camera.aspect = w / h;
    camera.near = 1;
    camera.far = camDist + 2000;
    camera.position.set(w / 2, h / 2, camDist);
    camera.lookAt(w / 2, h / 2, 0);
    camera.updateProjectionMatrix();
  }, [updateMetrics]);

  // --- rAF controller (dirty-flag; only while visible + tab foregrounded) ---
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
    lastFrameRef.current = 0;
    const tick = (time: number) => {
      if (!runningRef.current) return;

      // Ease idle activity down once the settle hold elapses; a wake resets it.
      const dt = lastFrameRef.current ? time - lastFrameRef.current : 16;
      lastFrameRef.current = time;
      if (!reducedRef.current && time - lastWakeRef.current > IDLE_HOLD_MS) {
        activityRef.current = Math.max(0, activityRef.current - dt / IDLE_DECAY_MS);
      }

      applyPosesRef.current(time, false);

      // True idle stop: once drift has fully faded, render nothing more until
      // the next scroll / resize / IO wake.
      if (activityRef.current <= 0.001) {
        stopLoop();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopLoop]);

  // Reset idle activity and (re)start the loop on any interaction.
  const wake = useCallback(() => {
    if (reducedRef.current) return;
    activityRef.current = 1;
    lastWakeRef.current =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const active =
      visibleRef.current &&
      (typeof document === "undefined" || document.visibilityState !== "hidden");
    if (active) startLoop();
  }, [startLoop]);

  const renderStatic = useCallback((rest: boolean) => {
    if (staticRafRef.current) return;
    staticRafRef.current = requestAnimationFrame((time) => {
      staticRafRef.current = 0;
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
    if (active) wake();
    else stopLoop();
  }, [renderStatic, stopLoop, wake]);

  // Scene setup / teardown.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const narrow = window.innerWidth < 768;
    const renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !narrow,
      premultipliedAlpha: false,
      powerPreference: narrow ? "low-power" : "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    if ("outputColorSpace" in renderer) renderer.outputColorSpace = SRGBColorSpace;
    rendererRef.current = renderer;

    const scene = new Scene();
    sceneRef.current = scene;
    const lights = createLights();
    for (const light of lights) scene.add(light);
    lightsRef.current = lights;

    const camera = new PerspectiveCamera(FOV, 1, 1, 5000);
    cameraRef.current = camera;

    const geo = createCoinGeometry();
    geoRef.current = geo;
    const mats = createCoinMaterials();
    matsRef.current = mats;
    const shadowTex = createShadowTexture();
    const loader = new TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const coins: Coin[] = [];
    const shadows: Mesh[] = [];
    appearRef.current = CIRCLE_LOGOS.map(() => 0);

    CIRCLE_LOGOS.forEach((logo, i) => {
      const texture: Texture = loader.load(`/logos/${logo.file}`, () => {
        renderStatic(reducedRef.current);
      });
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = maxAniso;

      const shadow = createShadow(geo, shadowTex);
      scene.add(shadow);
      shadows.push(shadow);

      // Vary the rim tint by depth tier so the chips aren't all identical.
      const rimIndex = Math.round((circles[i]?.depthTier ?? 0.5) * 2);
      const coin = createCoin(geo, mats, texture, rimIndex);
      scene.add(coin.group);
      coins.push(coin);
    });
    coinsRef.current = coins;
    shadowsRef.current = shadows;

    resize();
    remeasure();
    applyPoses(0, reducedRef.current);

    return () => {
      stopLoop();
      if (staticRafRef.current) cancelAnimationFrame(staticRafRef.current);
      staticRafRef.current = 0;
      for (const coin of coins) {
        scene.remove(coin.group);
        coin.logoMat.dispose();
        (coin.logoMat.map as Texture | null)?.dispose();
      }
      for (const shadow of shadows) {
        scene.remove(shadow);
        (shadow.material as { dispose: () => void }).dispose();
      }
      for (const light of lights) {
        scene.remove(light);
        light.dispose();
      }
      lightsRef.current = [];
      for (const rim of mats.rimMats) rim.dispose();
      mats.capMat.dispose();
      shadowTex.dispose();
      geo.blank.dispose();
      geo.decal.dispose();
      geo.shadow.dispose();
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      coinsRef.current = [];
      shadowsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    resize();
    remeasure();
    syncActive();
    if (!runningRef.current) renderStatic(reducedRef.current);

    const onResize = () => {
      resize();
      remeasure();
      if (reducedRef.current) renderStatic(true);
      else wake();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [remeasure, renderStatic, resize, syncActive, wake, isDesktop, pathConfig, reduced]);

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
    if (reducedRef.current) {
      if (visibleRef.current) renderStatic(true);
    } else if (visibleRef.current) {
      wake();
    }
  });

  useEffect(() => {
    const onScroll = () => {
      if (reducedRef.current) {
        if (visibleRef.current) renderStatic(true);
      } else if (visibleRef.current) {
        wake();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [renderStatic, wake]);

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
      <canvas ref={canvasRef} className="sticky left-0 top-0 block h-screen w-full" />
    </div>
  );
}
