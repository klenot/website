import { describe, expect, it } from "vitest";
import {
  SPREAD_BREAKPOINTS,
  SPREAD_INSET_FRAC,
  interpolateProgress,
  spreadMarginPx,
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
