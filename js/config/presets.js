import { randomChoice, randomStepped } from "../utils/random.js";
import { clamp } from "../utils/math.js";

export const CONTROL_DEFS = [
  {
    id: "volume",
    label: "Master Volume",
    min: 0,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(Number(v))}%`
  },
  {
    id: "rate",
    label: "Bubble Rate",
    min: 0.2,
    max: 30,
    step: 0.1,
    format: (v) => `${Number(v).toFixed(1)}/s`
  },
  {
    id: "basePitch",
    label: "Base Pitch",
    min: 40,
    max: 1400,
    step: 1,
    format: (v) => `${Math.round(Number(v))} Hz`
  },
  {
    id: "pitchVar",
    label: "Pitch Variation",
    min: 0,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(Number(v))}%`
  },
  {
    id: "pitchBend",
    label: "Pitch Bend",
    min: -12,
    max: 12,
    step: 0.5,
    format: (v) => {
      const n = Number(v);
      return `${n > 0 ? "+" : ""}${n} st`;
    }
  },
  {
    id: "size",
    label: "Bubble Size",
    min: 0,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(Number(v))}%`
  },
  {
    id: "resonance",
    label: "Resonance",
    min: 1,
    max: 30,
    step: 0.5,
    format: (v) => Number(v).toFixed(1)
  },
  {
    id: "noise",
    label: "Noise Texture",
    min: 0,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(Number(v))}%`
  },
  {
    id: "muffle",
    label: "Water Depth / Muffle",
    min: 0,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(Number(v))}%`
  },
  {
    id: "width",
    label: "Stereo Width",
    min: 0,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(Number(v))}%`
  },
  {
    id: "clustering",
    label: "Clustering",
    min: 0,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(Number(v))}%`
  }
];

export const WAVEFORMS = ["sine", "triangle", "square", "sawtooth"];
export const DEFAULT_WAVE = "sine";

export const PRESETS = [
  {
    id: "gentle",
    label: "Gentle Brook",
    params: {
      volume: 72,
      rate: 4.5,
      basePitch: 430,
      pitchVar: 42,
      pitchBend: 3,
      size: 26,
      resonance: 8,
      noise: 18,
      muffle: 22,
      width: 70,
      clustering: 18,
      wave: "sine"
    }
  },
  {
    id: "boiling",
    label: "Boiling Pot",
    params: {
      volume: 76,
      rate: 19,
      basePitch: 250,
      pitchVar: 36,
      pitchBend: 1.5,
      size: 42,
      resonance: 6.5,
      noise: 42,
      muffle: 34,
      width: 35,
      clustering: 48,
      wave: "sine"
    }
  },
  {
    id: "deep",
    label: "Deep Gloop",
    params: {
      volume: 82,
      rate: 1.5,
      basePitch: 92,
      pitchVar: 28,
      pitchBend: -6,
      size: 86,
      resonance: 13,
      noise: 26,
      muffle: 48,
      width: 45,
      clustering: 14,
      wave: "sine"
    }
  },
  {
    id: "fizzy",
    label: "Fizzy Soda",
    params: {
      volume: 64,
      rate: 25,
      basePitch: 940,
      pitchVar: 72,
      pitchBend: 6.5,
      size: 9,
      resonance: 16,
      noise: 62,
      muffle: 8,
      width: 86,
      clustering: 68,
      wave: "triangle"
    }
  },
  {
    id: "vent",
    label: "Underwater Vent",
    params: {
      volume: 74,
      rate: 7.5,
      basePitch: 175,
      pitchVar: 56,
      pitchBend: -3,
      size: 61,
      resonance: 21,
      noise: 78,
      muffle: 58,
      width: 92,
      clustering: 36,
      wave: "sine"
    }
  },
  {
    id: "kettle",
    label: "Kettle Simmer",
    params: {
      volume: 70,
      rate: 12,
      basePitch: 320,
      pitchVar: 38,
      pitchBend: 2,
      size: 34,
      resonance: 7,
      noise: 32,
      muffle: 30,
      width: 40,
      clustering: 30,
      wave: "sine"
    }
  }
];

export const DEFAULT_PRESET_ID = "gentle";

export function getPreset(id) {
  return PRESETS.find((preset) => preset.id === id) ?? null;
}

export const DEFAULT_PARAMS = Object.freeze({
  ...getPreset(DEFAULT_PRESET_ID).params
});

function roundToStep(value, step) {
  if (!step) {
    return value;
  }

  return Number((Math.round(value / step) * step).toFixed(3));
}

export function sanitizeParams(candidate = {}) {
  const result = {};

  for (const def of CONTROL_DEFS) {
    const raw = candidate[def.id];
    const fallback = DEFAULT_PARAMS[def.id];

    if (raw === undefined || raw === null || raw === "") {
      result[def.id] = fallback;
      continue;
    }

    const value = Number(raw);

    if (!Number.isFinite(value)) {
      result[def.id] = fallback;
      continue;
    }

    result[def.id] = clamp(roundToStep(value, def.step), def.min, def.max);
  }

  result.wave = WAVEFORMS.includes(candidate.wave) ? candidate.wave : DEFAULT_WAVE;

  return result;
}

export function randomParams() {
  const result = {};

  for (const def of CONTROL_DEFS) {
    result[def.id] = randomStepped(def.min, def.max, def.step);
  }

  result.wave = randomChoice(["sine", "sine", "sine", "triangle", "triangle"]);

  return result;
}
