import { describe, expect, it } from "vitest";
import {
  boxBandFromMargin,
  boxHeightDelta,
  EMPTY_LAYOUT_CACHE,
  pathEndpointLocal,
  type LayoutCache,
} from "./circleLayoutCache";
import {
  isScrubbing,
  PACK_CROSS_AT,
  packWarp,
  placeCircles,
  type CircleModel,
} from "./placeCircles";
import { BOX_COUNT, makeCircles } from "./circleFieldModel";

function baseCache(overrides: Partial<LayoutCache> = {}): LayoutCache {
  return {
    ...EMPTY_LAYOUT_CACHE,
    valid: true,
    overlayWidth: 1000,
    overlayDocLeft: 0,
    overlayDocTop: 100,
    bandTop: 400,
    heroW: 1000,
    heroH: 400,
    heroSectionTop: 0,
    heroSectionH: 400,
    aspect: 16 / 9,
    marginAtMeasure: 8,
    path: {
      valid: true,
      sectionDocTop: 2000,
      sectionHeight: 2000,
      svgDocLeft: 100,
      svgDocTop: 2100,
      svgW: 800,
      svgH: 400,
      viewBoxW: 1000,
      viewBoxH: 500,
      startX: 0,
      startY: 0,
      endX: 1000,
      endY: 500,
    },
    ...overrides,
  };
}

describe("boxBandFromMargin", () => {
  it("derives band from margin without DOM", () => {
    const band = boxBandFromMargin(baseCache(), 8);
    expect(band.bandLeft).toBeCloseTo(8 + 984 * 0.04);
    expect(band.bandW).toBeCloseTo(984 * 0.92);
    expect(band.bandTop).toBe(400);
    expect(band.bandH).toBeCloseTo(984 / (16 / 9));
  });
});

describe("boxHeightDelta", () => {
  it("is zero at the measured margin", () => {
    expect(boxHeightDelta(baseCache(), 8)).toBeCloseTo(0);
  });

  it("grows when margin shrinks (full-bleed)", () => {
    expect(boxHeightDelta(baseCache(), 0)).toBeGreaterThan(0);
  });
});

describe("pathEndpointLocal", () => {
  it("returns null when path cache is invalid", () => {
    const cache = baseCache({
      path: { ...baseCache().path, valid: false },
    });
    expect(pathEndpointLocal(cache, 8, 0, 0, 800, "start")).toBeNull();
  });

  it("tracks sticky pin in overlay-local space as scroll advances", () => {
    const cache = baseCache();
    const atPin = pathEndpointLocal(cache, 8, 2000, 0, 800, "start");
    const deeper = pathEndpointLocal(cache, 8, 2200, 0, 800, "start");
    expect(atPin).not.toBeNull();
    expect(deeper).not.toBeNull();
    // Overlay scrolls up; local Y of a pinned SVG point must increase.
    expect(deeper!.y).toBeGreaterThan(atPin!.y);
    expect(deeper!.y - atPin!.y).toBeCloseTo(200);
  });

  it("does not jump to in-flow top after sticky releases at section end", () => {
    const cache = baseCache();
    // pinDistance = sectionHeight - viewportH = 1200
    // last pinned scrollY = sectionDocTop + pinDistance = 3200
    const lastPinned = pathEndpointLocal(cache, 8, 3200, 0, 800, "start");
    const justAfter = pathEndpointLocal(cache, 8, 3201, 0, 800, "start");
    const afterRelease = pathEndpointLocal(cache, 8, 3400, 0, 800, "start");
    expect(lastPinned).not.toBeNull();
    expect(justAfter).not.toBeNull();
    expect(afterRelease).not.toBeNull();
    // Continuous through release — overlay-local Y must not drop (old bug jumped
    // to in-flow top and clipped logos out of the overflow-hidden overlay).
    expect(justAfter!.y).toBeCloseTo(lastPinned!.y, 0);
    expect(afterRelease!.y).toBeCloseTo(lastPinned!.y, 0);
    expect(afterRelease!.y).toBeGreaterThan(3000);
  });
});

describe("isScrubbing", () => {
  it("detects mid travel and mid path", () => {
    expect(isScrubbing(0, 0)).toBe(false);
    expect(isScrubbing(1, 0)).toBe(false);
    expect(isScrubbing(0.5, 0)).toBe(true);
    expect(isScrubbing(1, 0.5)).toBe(true);
  });
});

describe("packWarp", () => {
  it("pins the endpoints and moves the lip crossing to the shared travel", () => {
    for (const lipAt of [0.15, 0.4, 0.6, 0.85]) {
      expect(packWarp(0, lipAt, 0.5)).toBe(0);
      expect(packWarp(1, lipAt, 0.5)).toBe(1);
      expect(packWarp(0.5, lipAt, 0.5)).toBeCloseTo(lipAt);
    }
  });

  it("is monotone (never reverses mid-scrub)", () => {
    for (const lipAt of [0.1, 0.3, 0.7, 0.92]) {
      let prev = 0;
      for (let k = 1; k <= 400; k++) {
        const v = packWarp(k / 400, lipAt, 0.52);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = v;
      }
    }
  });
});

describe("pack handoff cohesion", () => {
  it("every hero chip crosses the lip inside one narrow travel window", () => {
    const circles = makeCircles();
    const cache = baseCache({ heroH: 800, bandTop: 800, overlayWidth: 1280, heroW: 1280 });
    const crossAt: number[] = [];
    for (let i = BOX_COUNT; i < circles.length; i++) {
      let prevBelow = false;
      for (let k = 0; k <= 1000; k++) {
        const travel = k / 1000;
        const [pose] = placeCircles({
          circles: [circles[i]],
          cache,
          travel,
          pathTravel: 0,
          marginPx: 45,
          scrollY: 0,
          scrollX: 0,
          viewportW: 1280,
          viewportH: 800,
          time: 0,
          rest: false,
          isDesktop: true,
          maxVisible: 1,
          mobileHeroSlots: [],
          boxCount: BOX_COUNT,
          driftScale: 0,
        });
        const below = pose.y >= cache.bandTop;
        if (below && !prevBelow) {
          crossAt.push(travel);
          break;
        }
        prevBelow = below;
      }
    }
    expect(crossAt).toHaveLength(circles.length - BOX_COUNT);
    const spread = Math.max(...crossAt) - Math.min(...crossAt);
    expect(spread).toBeLessThan(0.16);
    for (const t of crossAt) expect(Math.abs(t - PACK_CROSS_AT)).toBeLessThan(0.08);
  });
});

describe("placeCircles", () => {
  const circle: CircleModel = {
    origin: "box",
    fromX: 0.5,
    fromY: 0.5,
    toX: 0.5,
    toY: 0.5,
    dax: 0,
    day: 0,
    fx: 0,
    fy: 0,
    phase: 0,
  };

  it("places a box circle inside the derived band", () => {
    const poses = placeCircles({
      circles: [circle],
      cache: baseCache(),
      travel: 0,
      pathTravel: 0,
      marginPx: 8,
      scrollY: 0,
      scrollX: 0,
      viewportW: 1000,
      viewportH: 800,
      time: 0,
      rest: true,
      isDesktop: true,
      maxVisible: 1,
      mobileHeroSlots: [],
      boxCount: 9,
    });
    const band = boxBandFromMargin(baseCache(), 8);
    expect(poses[0].hidden).toBe(false);
    expect(poses[0].x).toBeCloseTo(band.bandLeft + 0.5 * band.bandW);
    expect(poses[0].y).toBeCloseTo(band.bandTop + 0.5 * band.bandH);
  });

  it("hides circles past maxVisible", () => {
    const poses = placeCircles({
      circles: [circle, circle],
      cache: baseCache(),
      travel: 0,
      pathTravel: 0,
      marginPx: 8,
      scrollY: 0,
      scrollX: 0,
      viewportW: 1000,
      viewportH: 800,
      time: 0,
      rest: true,
      isDesktop: true,
      maxVisible: 1,
      mobileHeroSlots: [],
      boxCount: 9,
    });
    expect(poses[1].hidden).toBe(true);
  });

  it("keeps path circles static on locked endpoints (no drift)", () => {
    const pathCircle: CircleModel = {
      ...circle,
      pathDest: "start",
      dax: 1.2,
      day: 1.2,
      fx: 0.001,
      fy: 0.001,
      phase: 0,
    };
    const locked = { x: 120, y: 340 };
    const posesA = placeCircles({
      circles: [pathCircle],
      cache: baseCache(),
      travel: 1,
      pathTravel: 1,
      marginPx: 8,
      scrollY: 3200,
      scrollX: 0,
      viewportW: 1000,
      viewportH: 800,
      time: 0,
      rest: false,
      isDesktop: true,
      maxVisible: 1,
      mobileHeroSlots: [],
      boxCount: 9,
      pathEndpoints: { start: locked, end: null },
    });
    const posesB = placeCircles({
      circles: [pathCircle],
      cache: baseCache(),
      travel: 1,
      pathTravel: 1,
      marginPx: 8,
      scrollY: 3200,
      scrollX: 0,
      viewportW: 1000,
      viewportH: 800,
      time: 5000,
      rest: false,
      isDesktop: true,
      maxVisible: 1,
      mobileHeroSlots: [],
      boxCount: 9,
      pathEndpoints: { start: locked, end: null },
    });
    expect(posesA[0].x).toBeCloseTo(locked.x);
    expect(posesA[0].y).toBeCloseTo(locked.y);
    expect(posesB[0].x).toBeCloseTo(locked.x);
    expect(posesB[0].y).toBeCloseTo(locked.y);
  });
});
