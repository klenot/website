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
import { boxBandFromMargin } from "./circleLayoutCache";
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
  createCoinGeometry,
  createCoinMaterials,
  createFlatCoin,
  createLights,
  createLitCoin,
  createMouthOccluder,
  createShadow,
  createShadowTexture,
  setLightsEnabled,
  type Coin,
  type CoinGeometry,
  type CoinMaterials,
} from "./coinFactory";

const FOV = 30;
// Small per-tier z only for correct-sorted overlaps; visible near/far comes from
// a baked SIZE multiplier (below), so landing stays pixel-exact.
const Z_SORT = 72;
const HERO_LIFT = 88; // chips float a little in front while up in the hero

// Idle stop: after this long with no scroll/resize/IO wake, drift eases to 0
// over the decay window and the rAF loop halts until the next wake.
const IDLE_HOLD_MS = 220;
const IDLE_DECAY_MS = 900;
/** Mobile scrub cap (~30 FPS) — Marek device scroll perf. */
const MOBILE_FRAME_MS = 33;

const smoother = (t: number) => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * c * (c * (c * 6 - 15) + 10);
};
const gauss = (x: number, mu: number, sigma: number) => {
  const d = (x - mu) / sigma;
  return Math.exp(-0.5 * d * d);
};
const sstep = (a: number, b: number, x: number) => {
  const t = a === b ? (x >= b ? 1 : 0) : (x - a) / (b - a);
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

const MAX_LOGO_SIZE = Math.max(...CIRCLE_LOGOS.map((l) => l.size));

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
  const occluderRef = useRef<Mesh | null>(null);
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
  const lastRenderRef = useRef(0);
  const mobileFlatRef = useRef(false);
  const poolCountRef = useRef(0);
  const shadowTexRef = useRef<Texture | null>(null);

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

      // Mouth geometry (overlay-local): where the box top sits + how deep the
      // rim occludes. The occluder is TALL (covers the box interior below the
      // lip) so a straddling chip — which is the only thing dipped behind it —
      // shows a clean cap above the lip, never a mid-slice or bottom sliver.
      const band = boxBandFromMargin(cache, mgn);
      const boxTopLocalY = band.bandTop;
      const maxScreenR = (MAX_LOGO_SIZE * scale * 1.17) / 2;
      const occH = Math.max(maxScreenR * 2.6, band.bandH * 0.5);

      for (let i = 0; i < coins.length; i++) {
        const coin = coins[i];
        const shadow = shadows[i];
        const pose = poses[i];
        const c = circles[i];

        if (pose.hidden) {
          coin.group.visible = false;
          if (shadow) shadow.visible = false;
          continue;
        }

        const tier = c.depthTier ?? 0.5;
        const nearF = 1 - tier;

        // Appear (scale-in) reveal — box coins start visible (cast continuity).
        const appearRate = c.origin === "box" ? 1 : 0.06 + (i - BOX_COUNT) * 0.012;
        const ap = rest ? 1 : Math.min(1, appear[i] + appearRate);
        appear[i] = ap;
        const apEase = ap * ap * (3 - 2 * ap);

        // Near/far SIZE (drives visible parallax; landing stays pixel-exact).
        const sizeMul = 1 + (nearF - 0.5) * 0.44;
        const settle = c.origin === "box" ? 1 : 1 + (1 - dockEase) * 0.05;
        const screenR = (CIRCLE_LOGOS[i].size * scale * sizeMul * settle) / 2;

        // --- MOUTH: a chip straddling the box top dips behind the rim occluder
        //     (which lives just behind z=0, so settled/hero chips never clip) and
        //     squashes vertically as it squeezes through the lip. Position-based,
        //     so it only affects chips actually crossing — never stuck behind. ---
        // Wide straddle band so 2–3 chips can half-clip at the lip mid-handoff.
        const dCross = pose.y - boxTopLocalY; // + = below the box top
        const straddle =
          c.origin === "hero"
            ? sstep(-screenR * 1.15, -screenR * 0.08, dCross) *
              (1 - sstep(screenR * 0.08, screenR * 1.15, dCross))
            : 0;

        // Depth: sort offset kept >= 0 so nothing but a straddling chip is ever
        // behind the occluder; near tier sits in front for correct overlaps.
        const zSort = nearF * Z_SORT;
        const zHero = HERO_LIFT + nearF * 36;
        // Plane settle: orbit in z while hero-floating, ease down to card plane.
        const zOrbit = c.origin === "hero" ? (1 - dockEase) * (zHero - zSort) : 0;
        let zc = zSort + zOrbit;
        zc += Math.sin(frameTime * 0.0004 * (0.55 + nearF) + c.phase) * 7 * nearF * idle;
        zc -= 130 * straddle; // dip behind the rim

        // --- depth-scaled scroll differential (near leads the dock, far lags) ---
        const lead = c.origin === "box" ? 0 : (nearF - 0.5) * 34 * gauss(tv, 0.5, 0.2);

        // --- screen anchor (overlay-local px -> world, y-up) + idle parallax ---
        const idleT = frameTime * (0.55 + nearF * 0.9); // far drifts slower
        const parAmp = (0.45 + nearF) * 5.2 * idle;
        const worldScreenX =
          pose.x + Math.sin(idleT * (c.fx ?? 0.0005) + (c.spinPhase ?? 0)) * parAmp;
        const worldScreenY =
          canvasH -
          (pose.y +
            offY +
            lead +
            Math.cos(idleT * (c.fy ?? 0.0005) + (c.spinPhase ?? 0)) * parAmp * 0.7);

        // Keep the projected center locked to the target px at any depth.
        const f = (camDist - zc) / camDist;
        const worldX = canvasW / 2 + (worldScreenX - canvasW / 2) * f;
        const worldY = canvasH / 2 + (worldScreenY - canvasH / 2) * f;
        const worldR = screenR * f * apEase;

        coin.group.visible = apEase > 0.01;
        coin.group.position.set(worldX, worldY, zc);
        // Squash through the lip: pinch vertically, bulge slightly wide.
        coin.group.scale.set(
          Math.max(0.0001, worldR * (1 + 0.14 * straddle)),
          Math.max(0.0001, worldR * (1 - 0.34 * straddle)),
          Math.max(0.0001, worldR),
        );

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
        if (mobile || !shadow) {
          if (shadow) shadow.visible = false;
        } else {
          const shMat = shadow.material as { opacity: number };
          shadow.visible = true;
          const landFade = c.origin === "hero" ? dockEase : 1;
          const shScale = screenR * f * 2 * 1.55;
          shadow.position.set(worldX, worldY - worldR * 0.52, zc - 5);
          shadow.scale.set(shScale, shScale * 0.72, 1);
          shMat.opacity = 0.34 * apEase * landFade;
        }
      }

      // Rim occluder: plain black bar at the box top edge (invisible on the
      // black card — no lit line), sitting just behind z=0 so only straddling
      // chips tuck under it.
      const occ = occluderRef.current;
      if (occ) {
        const boxW = Math.max(1, canvasW - 2 * mgn);
        const topWorldY = canvasH - (band.bandTop + offY);
        occ.position.set(canvasW / 2, topWorldY - occH / 2, -2);
        occ.scale.set(boxW, occH, 1);
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
    const dpr = Math.min(window.devicePixelRatio || 1, narrow ? 1.0 : 1.25);
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

      // Mobile scrub throttle (~30 FPS) — skip pose/render, keep the loop alive.
      if (mobileRef.current && lastRenderRef.current > 0) {
        if (time - lastRenderRef.current < MOBILE_FRAME_MS) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
      }

      // Ease idle activity down once the settle hold elapses; a wake resets it.
      const dt = lastFrameRef.current ? time - lastFrameRef.current : 16;
      lastFrameRef.current = time;
      if (!reducedRef.current && time - lastWakeRef.current > IDLE_HOLD_MS) {
        activityRef.current = Math.max(0, activityRef.current - dt / IDLE_DECAY_MS);
      }

      applyPosesRef.current(time, false);
      lastRenderRef.current = time;

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

  const disposeCoin = useCallback((coin: Coin, scene: Scene) => {
    scene.remove(coin.group);
    coin.logoMat.dispose();
    (coin.logoMat.map as Texture | null)?.dispose();
    if (coin.mode === "flat") {
      (coin.blank.material as { dispose: () => void }).dispose();
    }
  }, []);

  const syncCoinPool = useCallback(() => {
    const scene = sceneRef.current;
    const geo = geoRef.current;
    const mats = matsRef.current;
    const renderer = rendererRef.current;
    if (!scene || !geo || !mats || !renderer) return;

    const narrow = window.innerWidth < 768;
    const count = narrow ? 6 : CIRCLE_LOGOS.length;
    const useFlat = narrow;
    mobileRef.current = narrow;
    maxVisibleRef.current = count;

    if (poolCountRef.current === count && mobileFlatRef.current === useFlat) return;

    // Tear down the previous pool.
    for (const coin of coinsRef.current) disposeCoin(coin, scene);
    for (const shadow of shadowsRef.current) {
      scene.remove(shadow);
      (shadow.material as { dispose: () => void }).dispose();
    }
    if (shadowTexRef.current) {
      shadowTexRef.current.dispose();
      shadowTexRef.current = null;
    }
    coinsRef.current = [];
    shadowsRef.current = [];

    setLightsEnabled(lightsRef.current, !useFlat);
    mobileFlatRef.current = useFlat;
    poolCountRef.current = count;

    const loader = new TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    let shadowTex: Texture | null = null;
    if (!useFlat) {
      shadowTex = createShadowTexture();
      shadowTexRef.current = shadowTex;
    }

    const coins: Coin[] = [];
    const shadows: Mesh[] = [];
    const appear: number[] = [];

    for (let i = 0; i < count; i++) {
      const logo = CIRCLE_LOGOS[i];
      const texture: Texture = loader.load(`/logos/${logo.file}`, () => {
        renderStatic(reducedRef.current);
      });
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = narrow ? 1 : maxAniso;

      if (!useFlat && shadowTex) {
        const shadow = createShadow(geo, shadowTex);
        scene.add(shadow);
        shadows.push(shadow);
      }

      const rimIndex = Math.round((circles[i]?.depthTier ?? 0.5) * 2);
      const coin = useFlat
        ? createFlatCoin(geo, texture, rimIndex)
        : createLitCoin(geo, mats, texture, rimIndex);
      scene.add(coin.group);
      coins.push(coin);

      // Cast continuity: box coins visible from idle; hero coins stage in.
      appear.push(circles[i]?.origin === "box" ? 1 : 0);
    }

    coinsRef.current = coins;
    shadowsRef.current = shadows;
    appearRef.current = appear;
  }, [circles, disposeCoin, renderStatic]);

  // Scene setup / teardown.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const narrow = window.innerWidth < 768;
    mobileRef.current = narrow;
    maxVisibleRef.current = narrow ? 6 : CIRCLE_LOGOS.length;

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
    setLightsEnabled(lights, !narrow);

    const camera = new PerspectiveCamera(FOV, 1, 1, 5000);
    cameraRef.current = camera;

    const geo = createCoinGeometry();
    geoRef.current = geo;
    const mats = createCoinMaterials();
    matsRef.current = mats;

    const occluder = createMouthOccluder();
    scene.add(occluder);
    occluderRef.current = occluder;

    mobileFlatRef.current = narrow;
    poolCountRef.current = 0;
    syncCoinPool();

    resize();
    remeasure();
    applyPoses(0, reducedRef.current);

    return () => {
      stopLoop();
      if (staticRafRef.current) cancelAnimationFrame(staticRafRef.current);
      staticRafRef.current = 0;
      for (const coin of coinsRef.current) disposeCoin(coin, scene);
      for (const shadow of shadowsRef.current) {
        scene.remove(shadow);
        (shadow.material as { dispose: () => void }).dispose();
      }
      shadowTexRef.current?.dispose();
      shadowTexRef.current = null;
      for (const light of lights) {
        scene.remove(light);
        light.dispose();
      }
      lightsRef.current = [];
      for (const rim of mats.rimMats) rim.dispose();
      mats.capMat.dispose();
      geo.blank.dispose();
      geo.decal.dispose();
      geo.shadow.dispose();
      geo.flatRim.dispose();
      geo.flatFace.dispose();
      scene.remove(occluder);
      (occluder.material as { dispose: () => void }).dispose();
      occluder.geometry.dispose();
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      coinsRef.current = [];
      shadowsRef.current = [];
      poolCountRef.current = 0;
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
      syncCoinPool();
      remeasure();
      if (reducedRef.current) renderStatic(true);
      else wake();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [remeasure, renderStatic, resize, syncActive, syncCoinPool, wake, isDesktop, pathConfig, reduced]);

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
