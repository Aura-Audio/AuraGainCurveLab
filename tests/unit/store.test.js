import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../../js/state/store.js";
import { DEFAULT_PARAMS } from "../../js/config/presets.js";

describe("Store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("clamps parameter updates and clears active preset", () => {
    const store = new Store({
      params: DEFAULT_PARAMS,
      activePresetId: "gentle"
    });

    store.setParam("volume", 500);

    expect(store.getState().params.volume).toBe(100);
    expect(store.getState().activePresetId).toBeNull();
  });

  it("applies presets", () => {
    const store = new Store();

    store.applyPreset("deep");

    expect(store.getState().activePresetId).toBe("deep");
    expect(store.getState().params.basePitch).toBe(92);
  });

  it("toggles mute", () => {
    const store = new Store();

    expect(store.getState().muted).toBe(false);

    store.toggleMute();

    expect(store.getState().muted).toBe(true);
  });

  it("randomizes params and clears preset", () => {
    const store = new Store();

    store.randomize();

    expect(store.getState().activePresetId).toBeNull();
    expect(store.getState().params.volume).toBeGreaterThanOrEqual(0);
    expect(store.getState().params.volume).toBeLessThanOrEqual(100);
  });
});
