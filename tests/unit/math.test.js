import { describe, expect, it } from "vitest";
import { clamp, lerp } from "../../js/utils/math.js";

describe("math utilities", () => {
  it("clamps values within bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("interpolates values", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(-10, 10, 0.25)).toBe(-5);
  });
});
