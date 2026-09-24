import { describe, expect, it } from "vitest";
import {
  SPREAD_BREAKPOINTS,
  SPREAD_INSET_FRAC,
  circleTravelFromSpread,
  interpolateProgress,
  spreadLayoutMarginPx,
  spreadMarginPx,
  spreadScale,
} from "@/components/sections/serviceReveal";

describe("interpolateProgress", () => {
  it("returns the first value before the first breakpoint", () => {
    expect(
      interpolateProgress(-1, SPREAD_BREAKPOINTS, SPREAD_INSET_FRAC),
    ).toBe(0.17);
  });

  it("returns the last value after the final breakpoint", () => {
    expect(
      interpolateProgress(2, SPREAD_BREAKPOINTS, SPREAD_INSET_FRAC),
    ).toBe(0.17);
  });

  it("interpolates between breakpoints", () => {
    const value = interpolateProgress(0.3, SPREAD_BREAKPOINTS, SPREAD_INSET_FRAC);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(0.17);
  });
});

describe("circleTravelFromSpread", () => {
  it("is 0 when the box is narrowest (hero)", () => {
    expect(circleTravelFromSpread(0)).toBe(0);
    expect(circleTravelFromSpread(0.25)).toBe(0);
  });

  it("is 1 when the box is widest (docked)", () => {
    expect(circleTravelFromSpread(0.35)).toBe(1);
    expect(circleTravelFromSpread(0.5)).toBe(1);
    expect(circleTravelFromSpread(0.8)).toBe(1);
  });

  it("returns to 0 when the box shrinks back", () => {
    expect(circleTravelFromSpread(0.9)).toBe(0);
    expect(circleTravelFromSpread(1)).toBe(0);
  });

  it("is mid-flight during the spread phase (mouth window)", () => {
    const mid = circleTravelFromSpread(0.3);
    expect(mid).toBeGreaterThan(0.35);
    expect(mid).toBeLessThan(0.65);
  });

  it("tracks inset in lockstep (travel rises as margin falls)", () => {
    const narrowMargin = spreadMarginPx(0.2, 1000);
    const wideMargin = spreadMarginPx(0.5, 1000);
    const travelNarrow = circleTravelFromSpread(0.2);
    const travelWide = circleTravelFromSpread(0.5);
    expect(narrowMargin).toBeGreaterThan(wideMargin);
    expect(travelNarrow).toBeLessThan(travelWide);
  });
});

describe("spreadMarginPx", () => {
  it("is a wide inset when the box is narrowest (progress 0)", () => {
    // 17% of a 1000px container, within clamp range.
    expect(spreadMarginPx(0, 1000)).toBeCloseTo(170);
  });

  it("keeps a gutter at max spread so it still reads as a card (progress 0.5)", () => {
    // 3.5% of 1000px — a visible gutter, not full-bleed.
    expect(spreadMarginPx(0.5, 1000)).toBeCloseTo(35);
  });

  it("clamps the inset on very narrow and very wide containers", () => {
    expect(spreadMarginPx(0, 40)).toBe(14); // min clamp
    expect(spreadMarginPx(0, 4000)).toBe(260); // max clamp
  });
});

describe("spreadScale (compositor stretch)", () => {
  it("reproduces the margin-driven box width exactly at every progress", () => {
    for (const width of [390, 768, 1280, 1920]) {
      const full = width - 2 * spreadLayoutMarginPx(width);
      for (let k = 0; k <= 100; k++) {
        const p = k / 100;
        const visual = spreadScale(p, width) * full;
        expect(visual).toBeCloseTo(width - 2 * spreadMarginPx(p, width), 6);
      }
    }
  });

  it("is 1 at full spread and < 1 while narrow", () => {
    expect(spreadScale(0.5, 1280)).toBeCloseTo(1);
    expect(spreadScale(0, 1280)).toBeLessThan(1);
    expect(spreadScale(1, 1280)).toBeLessThan(1);
  });

  it("moves in lockstep with circle travel (same keyframes)", () => {
    let prevS = 0;
    let prevT = -1;
    for (let k = 0; k <= 100; k++) {
      const p = 0.25 + (0.1 * k) / 100;
      const s = spreadScale(p, 1280);
      const t = circleTravelFromSpread(p);
      expect(s).toBeGreaterThanOrEqual(prevS - 1e-9);
      expect(t).toBeGreaterThanOrEqual(prevT - 1e-9);
      prevS = s;
      prevT = t;
    }
  });
});
