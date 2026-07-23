import { describe, expect, it } from "vitest";
import {
  CONTROL_DEFS,
  DEFAULT_PARAMS,
  DEFAULT_PRESET_ID,
  PRESETS,
  getPreset,
  randomParams,
  sanitizeParams
} from "../../js/config/presets.js";

const PARAM_KEYS = [...CONTROL_DEFS.map((def) => def.id), "wave"];

describe("presets", () => {
  it("has a default preset", () => {
    const preset = getPreset(DEFAULT_PRESET_ID);
    expect(preset).not.toBeNull();
  });

  it("includes all parameter keys in every preset", () => {
    for (const preset of PRESETS) {
      for (const key of PARAM_KEYS) {
        expect(preset.params).toHaveProperty(key);
      }
    }
  });

  it("sanitizes invalid values", () => {
    const sanitized = sanitizeParams({
      volume: 500,
      rate: -10,
      wave: "invalid"
    });

    expect(sanitized.volume).toBe(100);
    expect(sanitized.rate).toBe(0.2);
    expect(sanitized.wave).toBe("sine");
  });

  it("generates random params within valid bounds", () => {
    const params = randomParams();

    for (const def of CONTROL_DEFS) {
      expect(params[def.id]).toBeGreaterThanOrEqual(def.min);
      expect(params[def.id]).toBeLessThanOrEqual(def.max);
    }

    expect(typeof params.wave).toBe("string");
  });

  it("freezes default params at creation", () => {
    expect(DEFAULT_PARAMS).toBeTruthy();
    expect(DEFAULT_PARAMS.volume).toBeGreaterThanOrEqual(0);
  });
});
