"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import {
  type Light,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type Mesh,
  type PlaneGeometry,
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
  circleTravelFromSpread,
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
  MOBILE_POOL,
  MOBILE_VISIBLE_MASK,
  logoScaleForWidth,
  makeCircles,
  placeCircles,
} from "./circleFieldModel";
import {
  bakeChipFace,
  createCoinGeometry,
  createFlatCoin,
  createLights,
  createFloorSpill,
  createLipShade,
  createLitCoin,
  createShadow,
  createShadowTexture,
  createStudioEnvironment,
  disposeCoin,
  disposeCoinGeometry,
  setCoinEnv,
  setCoinShade,
  setFlatShadow,
  setLightsEnabled,
  type Coin,
  type CoinGeometry,
} from "./coinFactory";

const FOV = 30;
// Each chip owns a z slot (by depth tier) wide enough that tilted neighbours
// never interpenetrate; visible near/far comes from a baked SIZE multiplier
// (below) and projection is compensated, so landing stays pixel-exact.
const Z_STEP = 26;
const HERO_LIFT = 88; // chips float a little in front while up in the hero
/** Card floor plane sits just behind every chip's z slot. */
const FLOOR_Z = 40;

// Idle stop: after this long with no scroll/resize/IO wake, drift eases to 0
// over the decay window and the rAF loop halts until the next wake.
const IDLE_HOLD_MS = 220;
const IDLE_DECAY_MS = 900;
/** Mobile scrub cap (~30 FPS) — Marek device scroll perf. */
const MOBILE_FRAME_MS = 33;

// First reveal: every hero chip scales in together once all faces are baked;
// the per-chip offset is a hair so it reads as one breath, not a queue.
const APPEAR_MS = 620;
const APPEAR_STEP_MS = 18;
// Interior light inside the black card relative to the hero (1).
const INSIDE_SHADE_LIT = 0.86;
const INSIDE_SHADE_FLAT = 0.9;

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
  const coinsRef = useRef<(Coin | null)[]>([]);
  const shadowsRef = useRef<(Mesh | null)[]>([]);
  const appearStartRef = useRef(0);
  const lipShadeRef = useRef<Mesh<PlaneGeometry, ShaderMaterial> | null>(null);
  const floorRef = useRef<Mesh<PlaneGeometry, ShaderMaterial> | null>(null);
  const geoRef = useRef<CoinGeometry | null>(null);
  const envRef = useRef<Texture | null>(null);
  const lightsRef = useRef<Light[]>([]);
  const imagesRef = useRef(new Map<string, Promise<HTMLImageElement>>());
  const poolGenRef = useRef(0);

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
  const zSlot = useMemo(() => {
    const order = circles
      .map((c, i) => ({ i, tier: c.depthTier ?? 0.5 }))
      .sort((a, b) => b.tier - a.tier);
    const slots = new Array<number>(circles.length);
    order.forEach(({ i }, rank) => (slots[i] = rank * Z_STEP));
    return slots;
  }, [circles]);
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
  const travel = useTransform(scrollYProgress, circleTravelFromSpread);

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
        maxVisible: circles.length,
        visibleMask: mobile ? MOBILE_VISIBLE_MASK : undefined,
        mobileHeroSlots: MOBILE_HERO_SLOTS,
        boxCount: BOX_COUNT,
        driftScale: idle,
      });

      const scale = logoScaleForWidth(viewportRef.current.w);
      const band = boxBandFromMargin(cache, mgn);
      const boxTopLocalY = band.bandTop;
      const insideShade = mobileFlatRef.current ? INSIDE_SHADE_FLAT : INSIDE_SHADE_LIT;

      for (let i = 0; i < coins.length; i++) {
        const coin = coins[i];
        if (!coin) continue;
        const shadow = shadows[i];
        const pose = poses[i];
        const c = circles[i];

        if (pose.hidden) {
          coin.group.visible = false;
          if (shadow) shadow.visible = false;
          continue;
        }

        const hero = c.origin === "hero";
        const t = pose.t;
        const dock = smoother(t);
        const nearF = 1 - (c.depthTier ?? 0.5);

        let ap = 1;
        if (hero && !rest) {
          const start = appearStartRef.current + (i - BOX_COUNT) * APPEAR_STEP_MS;
          ap = Math.min(1, Math.max(0, (time - start) / APPEAR_MS));
        }
        const apEase = 1 - (1 - ap) * (1 - ap) * (1 - ap);

        // Near/far SIZE (drives visible parallax; landing stays pixel-exact).
        const sizeMul = 1 + (nearF - 0.5) * 0.44;
        const screenR = (CIRCLE_LOGOS[i].size * scale * sizeMul) / 2;

        // Depth-scaled scroll differential (near leads the dock, far lags).
        const lead = hero ? (nearF - 0.5) * 18 * gauss(t, 0.5, 0.2) : 0;
        const dCross = pose.y + lead - boxTopLocalY; // + = below the lip
        // 0 in the hero, 1 once fully inside the card — continuous across the lip.
        const inside = hero ? sstep(-screenR * 0.9, screenR * 1.6, dCross) : 1;

        // Mouth: the chip squashes and leans back as it tucks under the rail,
        // then a soft squash-and-settle as it lands on the card plane.
        const landU = hero ? Math.min(1, Math.max(0, (t - 0.74) / 0.26)) : 0;
        const landBump = Math.sin(Math.PI * landU) ** 2;
        const mouth = hero ? gauss(dCross, screenR * 0.15, screenR * 0.8) * (1 - landU) : 0;
        const squash = 0.05 * landBump + 0.17 * mouth;
        // Micro-spring: sink a hair past the slot, rebound, rest exactly on it.
        const spring = hero ? Math.sin(2 * Math.PI * landU) * (1 - landU) : 0;
        const settleY = screenR * 0.1 * spring;

        // Plane settle: hero chips hover in front, then ease down onto the card plane.
        const zPlane = zSlot[i];
        const zLift = hero ? (1 - dock) * (HERO_LIFT + nearF * 36) : 0;
        let zc = zPlane + zLift - 8 * landBump;
        zc += Math.sin(frameTime * 0.0004 * (0.55 + nearF) + c.phase) * 7 * nearF * idle;

        // --- screen anchor (overlay-local px -> world, y-up) + idle parallax ---
        const idleT = frameTime * (0.55 + nearF * 0.9); // far drifts slower
        const parAmp = (0.45 + nearF) * 5.2 * idle * (1 - inside);
        const worldScreenX =
          pose.x + Math.sin(idleT * (c.fx ?? 0.0005) + (c.spinPhase ?? 0)) * parAmp;
        const worldScreenY =
          canvasH -
          (pose.y +
            offY +
            lead +
            settleY +
            Math.cos(idleT * (c.fy ?? 0.0005) + (c.spinPhase ?? 0)) * parAmp * 0.7);

        // Keep the projected center locked to the target px at any depth.
        const f = (camDist - zc) / camDist;
        const worldX = canvasW / 2 + (worldScreenX - canvasW / 2) * f;
        const worldY = canvasH / 2 + (worldScreenY - canvasH / 2) * f;
        const worldR = screenR * f * apEase;

        coin.group.visible = apEase > 0.01;
        coin.group.position.set(worldX, worldY, zc);
        coin.group.scale.set(
          Math.max(0.0001, worldR * (1 + squash * 0.5)),
          Math.max(0.0001, worldR * (1 - squash)),
          Math.max(0.0001, worldR),
        );

        // Tilt: full rest tilt while floating, mostly levelled once on the plane.
        const restTilt = hero ? 1 - 0.55 * dock : 0.45;
        const tipIn = hero ? gauss(t, 0.5, 0.24) * 0.14 : 0;
        coin.group.rotation.x =
          (c.tiltX ?? 0) * restTilt +
          tipIn +
          0.3 * mouth +
          0.09 * spring +
          Math.sin(idleT * 0.0006 + (c.spinPhase ?? 0)) * 0.05 * (0.4 + nearF) * idle;
        coin.group.rotation.y =
          (c.tiltY ?? 0) * restTilt +
          Math.sin(idleT * 0.00052 + (c.spinPhase ?? 0) * 1.3) * 0.09 * (0.4 + nearF) * idle;

        setCoinShade(coin, 1 - (1 - insideShade) * inside);

        // One shadow model for both LODs: wide + offset while hovering over the
        // hero, a tight contact crescent once on the card floor.
        const lift = hero ? 1 - dock : 0;
        const shOff = 0.15 + 0.19 * lift; // x screenR
        const shRad = 1.22 + 0.12 * lift; // x screenR
        const shAlpha = (0.9 - 0.36 * lift) * apEase;
        if (coin.mode === "flat") {
          setFlatShadow(coin, shOff * 0.35, -shOff, shRad, shAlpha);
        } else if (shadow) {
          const off = screenR * shOff;
          const shScale = screenR * 2 * shRad * f * apEase;
          const shMat = shadow.material as { opacity: number };
          shadow.visible = apEase > 0.01;
          shadow.position.set(worldX + off * 0.35 * f, worldY - off * f, zc - 1);
          shadow.scale.set(shScale, shScale * 0.94, 1);
          shMat.opacity = shAlpha;
        }
      }

      const boxW = Math.max(1, canvasW - 2 * mgn);
      const topY = band.bandTop + offY;
      const maxScreenR = (MAX_LOGO_SIZE * scale * 1.22) / 2;
      const radius = interpolateProgress(
        scrollYProgress.get(),
        [0.25, 0.35, 0.8, 0.9],
        [24, 14, 14, 24],
      );
      const rail = Math.max(10, maxScreenR * 0.3);

      // Physical mouth over the chips: opaque rail + inner cast shadow.
      const shade = lipShadeRef.current;
      if (shade) {
        const depth = Math.max(1, Math.min(band.bandH, rail + maxScreenR * 1.5));
        shade.position.set(mgn + boxW / 2, canvasH - (topY + depth / 2), 0);
        shade.scale.set(boxW, depth, 1);
        const u = shade.material.uniforms;
        u.uSize.value.set(boxW, depth);
        u.uRadius.value = Math.min(depth, radius);
        u.uRail.value = rail;
      }

      // Floor spill behind the chips (depth-tested, projection-compensated).
      const floor = floorRef.current;
      if (floor) {
        const floorH = Math.max(1, band.bandH * 0.62);
        const fz = -FLOOR_Z;
        const ff = (camDist - fz) / camDist;
        const cx = mgn + boxW / 2;
        const cy = canvasH - (topY + floorH / 2);
        floor.position.set(
          canvasW / 2 + (cx - canvasW / 2) * ff,
          canvasH / 2 + (cy - canvasH / 2) * ff,
          fz,
        );
        floor.scale.set(boxW * ff, floorH * ff, 1);
        const u = floor.material.uniforms;
        u.uSize.value.set(boxW, floorH);
        u.uRadius.value = Math.min(floorH, radius);
        u.uStart.value = rail + maxScreenR * 0.9;
      }

      renderer.render(scene, camera);
    },
    [circles, marginPx, pathTravel, scrollYProgress, travel, zSlot],
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

  const loadImage = useCallback((file: string) => {
    const cache = imagesRef.current;
    let pending = cache.get(file);
    if (!pending) {
      pending = new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `/logos/${file}`;
      });
      cache.set(file, pending);
    }
    return pending;
  }, []);

  const clearPool = useCallback((scene: Scene) => {
    for (const coin of coinsRef.current) {
      if (!coin) continue;
      scene.remove(coin.group);
      disposeCoin(coin);
    }
    for (const shadow of shadowsRef.current) {
      if (!shadow) continue;
      scene.remove(shadow);
      (shadow.material as { dispose: () => void }).dispose();
    }
    coinsRef.current = [];
    shadowsRef.current = [];
  }, []);

  const syncCoinPool = useCallback(() => {
    const scene = sceneRef.current;
    const geo = geoRef.current;
    const renderer = rendererRef.current;
    if (!scene || !geo || !renderer) return;

    const narrow = window.innerWidth < 768;
    const indices = narrow ? MOBILE_POOL : CIRCLE_LOGOS.map((_, i) => i);
    const useFlat = narrow;
    mobileRef.current = narrow;

    if (poolCountRef.current === indices.length && mobileFlatRef.current === useFlat) return;

    clearPool(scene);
    setLightsEnabled(lightsRef.current, !useFlat);
    mobileFlatRef.current = useFlat;
    poolCountRef.current = indices.length;

    // Desktop-only resources: shadow quads + (deferred) studio IBL.
    if (!useFlat && !shadowTexRef.current) shadowTexRef.current = createShadowTexture();
    const shadowTex = shadowTexRef.current;
    const aniso = useFlat ? 1 : Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const gen = ++poolGenRef.current;

    // Build the whole cast at once so the first reveal is simultaneous.
    void Promise.all(
      indices.map((i) =>
        loadImage(CIRCLE_LOGOS[i].file).then(
          (img) => [i, img] as const,
          () => [i, null] as const,
        ),
      ),
    ).then((loaded) => {
      if (gen !== poolGenRef.current || sceneRef.current !== scene) return;
      const coins: (Coin | null)[] = new Array(circles.length).fill(null);
      const shadows: (Mesh | null)[] = new Array(circles.length).fill(null);
      for (const [i, img] of loaded) {
        if (!img) continue;
        const face = bakeChipFace(img, useFlat ? 128 : 160, useFlat);
        face.texture.anisotropy = aniso;
        if (!useFlat && shadowTex) {
          const shadow = createShadow(geo, shadowTex);
          shadow.visible = false;
          scene.add(shadow);
          shadows[i] = shadow;
        }
        const coin = useFlat ? createFlatCoin(geo, face) : createLitCoin(geo, face);
        if (envRef.current) setCoinEnv(coin, envRef.current);
        coin.group.visible = false;
        scene.add(coin.group);
        coins[i] = coin;
      }
      coinsRef.current = coins;
      shadowsRef.current = shadows;
      appearStartRef.current = performance.now();
      if (reducedRef.current) renderStatic(true);
      else {
        wake();
        if (!runningRef.current) renderStatic(false);
      }

      // PMREM bake waits until after first paint, off the critical path.
      if (!useFlat && !envRef.current) {
        const bake = () => {
          if (gen !== poolGenRef.current || rendererRef.current !== renderer) return;
          if (!envRef.current) envRef.current = createStudioEnvironment(renderer);
          for (const coin of coinsRef.current) if (coin) setCoinEnv(coin, envRef.current);
          if (!runningRef.current) renderStatic(reducedRef.current);
        };
        if (typeof requestIdleCallback === "function") requestIdleCallback(bake, { timeout: 1200 });
        else setTimeout(bake, 300);
      }
    });
  }, [circles, clearPool, loadImage, renderStatic, wake]);

  // Scene setup / teardown.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const narrow = window.innerWidth < 768;
    mobileRef.current = narrow;

    const renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !narrow,
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

    const lipShade = createLipShade();
    scene.add(lipShade);
    lipShadeRef.current = lipShade;
    const floor = createFloorSpill();
    scene.add(floor);
    floorRef.current = floor;

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
      clearPool(scene);
      shadowTexRef.current?.dispose();
      shadowTexRef.current = null;
      envRef.current?.dispose();
      envRef.current = null;
      for (const light of lights) {
        scene.remove(light);
        light.dispose();
      }
      lightsRef.current = [];
      disposeCoinGeometry(geo);
      scene.remove(lipShade);
      lipShade.material.dispose();
      lipShade.geometry.dispose();
      lipShadeRef.current = null;
      scene.remove(floor);
      floor.material.dispose();
      floor.geometry.dispose();
      floorRef.current = null;
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
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
    // Refresh landing band during the mouth window so lip straddles stay pixel-locked.
    if (value > 0.05 && value < 0.95) remeasure();
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
