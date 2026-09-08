"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import {
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
  createCoin,
  createCoinGeometry,
  createLights,
  createLip,
  createMouthOccluder,
  createShadow,
  createShadowTexture,
  type Coin,
  type CoinGeometry,
} from "./coinFactory";

const FOV = 30;
// z-depth tiers (world units on the pixel-mapped z=0 plane).
const Z_NEAR = 120;
const Z_FAR = -55;
const HERO_LIFT = 90; // how far in front coins float while in the hero
const MOUTH_DIP = -185; // extra z during the crossing → slip behind the lip

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
  const occluderRef = useRef<Mesh | null>(null);
  const lipRef = useRef<Mesh | null>(null);
  const geoRef = useRef<CoinGeometry | null>(null);

  const metricsRef = useRef<Metrics>({
    overlayDocTop: 0,
    overlayH: 1,
    canvasH: 1,
    canvasW: 1,
  });

  const visibleRef = useRef(false);
  const viewportRef = useRef({ w: 1, h: 1 });
  const landedRef = useRef(false);
  const lastScrollRef = useRef(0);
  const layoutRef = useRef<LayoutCache>(EMPTY_LAYOUT_CACHE);
  const isDesktopRef = useRef(false);
  const maxVisibleRef = useRef(CIRCLE_LOGOS.length);

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

      // Drift/idle gain: full at the scrub ends, killed mid-handoff and while
      // scrolling fast, so idle motion never fights the scrub / turnaround.
      const nearEnd = Math.min(tv, 1 - tv);
      const scrollVel = Math.abs(scrollY - lastScrollRef.current);
      lastScrollRef.current = scrollY;
      const velGain = 1 - Math.min(scrollVel / 55, 1) * 0.85;
      const driftGain = rest ? 0 : (1 - smoother((0.32 - nearEnd) / 0.32)) * velGain;

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

        // --- depth (z) with the mouth dip during the dock (staggered per coin
        //     so they don't all cross the lip on one synchronized line) ---
        const dipMu = 0.5 + (tier - 0.5) * 0.14;
        const dip = gauss(tv, dipMu, 0.16);
        const zBox = Z_NEAR + (Z_FAR - Z_NEAR) * tier;
        let zc: number;
        if (c.origin === "box") {
          zc = zBox;
        } else {
          const zHero = HERO_LIFT + nearF * 55;
          zc = zHero + (zBox - zHero) * dockEase + MOUTH_DIP * dip;
        }
        zc += Math.sin(frameTime * 0.0004 + c.phase) * 7 * nearF * driftGain; // z bob

        // --- screen anchor (overlay-local px -> world, y-up) + depth parallax ---
        const parAmp = (0.4 + nearF) * 4.5 * driftGain;
        const sx =
          pose.x + Math.sin(frameTime * (c.fx ?? 0.0005) + (c.spinPhase ?? 0)) * parAmp;
        const syTop =
          pose.y +
          offY +
          Math.cos(frameTime * (c.fy ?? 0.0005) + (c.spinPhase ?? 0)) * parAmp * 0.7;
        const worldScreenX = sx;
        const worldScreenY = canvasH - syTop;

        // Keep the projected center + size locked to the target px at any depth.
        const f = (camDist - zc) / camDist;
        const worldX = canvasW / 2 + (worldScreenX - canvasW / 2) * f;
        const worldY = canvasH / 2 + (worldScreenY - canvasH / 2) * f;
        const screenR = (CIRCLE_LOGOS[i].size * scale) / 2;
        const worldR = screenR * f * apEase;

        coin.group.visible = apEase > 0.01;
        coin.group.position.set(worldX, worldY, zc);
        coin.group.scale.setScalar(Math.max(0.0001, worldR));

        // --- tilt + idle micro-yaw (amplitude by depth) + tip through the lip ---
        // Tip leads the dip slightly and is wider so the forward lean is visible
        // before the coin tucks under the rim.
        const tipIn = c.origin === "box" ? 0 : gauss(tv, dipMu - 0.06, 0.2) * 0.42;
        coin.group.rotation.x =
          (c.tiltX ?? 0) +
          tipIn +
          Math.sin(frameTime * 0.0006 + (c.spinPhase ?? 0)) * 0.05 * (0.4 + nearF) * driftGain;
        coin.group.rotation.y =
          (c.tiltY ?? 0) +
          Math.sin(frameTime * 0.00052 + (c.spinPhase ?? 0) * 1.3) *
            0.09 *
            (0.4 + nearF) *
            driftGain;

        // --- grounded soft contact shadow (reads over the hero) ---
        const shMat = shadow.material as { opacity: number };
        shadow.visible = true;
        const shScale = screenR * f * 2 * 1.55;
        shadow.position.set(worldX, worldY - worldR * 0.5, zc - 6);
        shadow.scale.set(shScale, shScale, 1);
        shMat.opacity = 0.32 * apEase;
      }

      // --- mouth: thin occluder tucks coins under the rim; soft lip in front
      //     dissolves the seam and top-lights the settled cloud ---
      const band = boxBandFromMargin(cache, mgn);
      const boxW = Math.max(1, canvasW - 2 * mgn);
      const topWorldY = canvasH - (band.bandTop + offY);
      const occ = occluderRef.current;
      if (occ) {
        const occH = Math.min(48, Math.max(22, band.bandH * 0.05));
        occ.position.set(canvasW / 2, topWorldY - occH / 2, 0);
        occ.scale.set(boxW, occH, 1);
      }
      const lip = lipRef.current;
      if (lip) {
        const lipH = Math.min(160, Math.max(70, band.bandH * 0.2));
        lip.position.set(canvasW / 2, topWorldY - lipH / 2, 0);
        lip.scale.set(boxW, lipH, 1);
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
    maxVisibleRef.current = window.innerWidth < 768 ? 8 : CIRCLE_LOGOS.length;

    const narrow = window.innerWidth < 768;
    const dpr = Math.min(window.devicePixelRatio || 1, narrow ? 1.25 : 2);
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
    const tick = (time: number) => {
      if (!runningRef.current) return;
      applyPosesRef.current(time, false);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

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
      antialias: !narrow,
      premultipliedAlpha: false,
      powerPreference: narrow ? "low-power" : "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    if ("outputColorSpace" in renderer) renderer.outputColorSpace = SRGBColorSpace;
    rendererRef.current = renderer;

    const scene = new Scene();
    sceneRef.current = scene;
    for (const light of createLights()) scene.add(light);

    const camera = new PerspectiveCamera(FOV, 1, 1, 5000);
    cameraRef.current = camera;

    const geo = createCoinGeometry();
    geoRef.current = geo;
    const shadowTex = createShadowTexture();
    const loader = new TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const occluder = createMouthOccluder();
    scene.add(occluder);
    occluderRef.current = occluder;

    const lip = createLip();
    scene.add(lip);
    lipRef.current = lip;

    const coins: Coin[] = [];
    const shadows: Mesh[] = [];
    appearRef.current = CIRCLE_LOGOS.map(() => 0);

    CIRCLE_LOGOS.forEach((logo) => {
      const texture: Texture = loader.load(`/logos/${logo.file}`, () => {
        renderStatic(reducedRef.current);
      });
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = maxAniso;

      const shadow = createShadow(geo, shadowTex);
      scene.add(shadow);
      shadows.push(shadow);

      const coin = createCoin(geo, texture);
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
        coin.rimMat.dispose();
        coin.capMat.dispose();
        coin.logoMat.dispose();
        (coin.logoMat.map as Texture | null)?.dispose();
      }
      for (const shadow of shadows) {
        scene.remove(shadow);
        (shadow.material as { dispose: () => void }).dispose();
      }
      shadowTex.dispose();
      geo.blank.dispose();
      geo.decal.dispose();
      geo.shadow.dispose();
      (occluder.material as { dispose: () => void }).dispose();
      occluder.geometry.dispose();
      (lip.material as { map?: Texture | null; dispose: () => void }).map?.dispose();
      (lip.material as { dispose: () => void }).dispose();
      lip.geometry.dispose();
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
      if (!runningRef.current) renderStatic(reducedRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [remeasure, renderStatic, resize, syncActive, isDesktop, pathConfig, reduced]);

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
    if (reducedRef.current && visibleRef.current) renderStatic(true);
  });

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
