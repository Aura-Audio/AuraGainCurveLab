import { Store } from "./state/store.js";
import { AudioEngine } from "./audio/AudioEngine.js";
import { BubbleVisualizer } from "./visuals/BubbleVisualizer.js";
import { Controls } from "./ui/Controls.js";
import { Presets } from "./ui/Presets.js";
import { Transport } from "./ui/Transport.js";
import { qs } from "./ui/dom.js";
import { readParamsFromUrl, updateUrl } from "./utils/url.js";
import { loadState } from "./utils/storage.js";
import { DEFAULT_PRESET_ID, getPreset } from "./config/presets.js";

const elements = {
  startStop: qs("#start-stop"),
  randomize: qs("#randomize"),
  mute: qs("#mute"),
  reset: qs("#reset"),
  animationToggle: qs("#animation-toggle"),
  status: qs("#status"),
  presetName: qs("#preset-name"),
  presets: qs("#presets"),
  controls: qs("#controls"),
  canvas: qs("#scene")
};

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const storedState = loadState();
const urlParams = readParamsFromUrl();

const initialParams =
  urlParams ?? storedState?.params ?? getPreset(DEFAULT_PRESET_ID).params;

const initialActivePresetId = urlParams
  ? null
  : storedState?.activePresetId && getPreset(storedState.activePresetId)
    ? storedState.activePresetId
    : DEFAULT_PRESET_ID;

const store = new Store({
  params: initialParams,
  activePresetId: initialActivePresetId,
  muted: Boolean(storedState?.muted),
  animationEnabled:
    storedState?.animationEnabled ?? !motionQuery.matches
});

let visualizer;

const engine = new AudioEngine({
  initialParams: store.getState().params,
  onBubbleScheduled: (time, size) => {
    if (visualizer) {
      visualizer.scheduleBubble(time, size);
    }
  }
});

visualizer = new BubbleVisualizer({
  canvas: elements.canvas,
  getTime: () => engine.getCurrentTime()
});

const controls = new Controls({
  store,
  root: elements.controls
});

const presets = new Presets({
  store,
  root: elements.presets
});

const transport = new Transport({
  store,
  engine,
  elements
});

visualizer.setEnabled(store.getState().animationEnabled);

let urlTimer = 0;

store.subscribe((state) => {
  engine.updateParams(state.params);
  engine.updateMuted(state.muted);
  visualizer.setEnabled(state.animationEnabled);

  window.clearTimeout(urlTimer);

  urlTimer = window.setTimeout(() => {
    updateUrl(state.params);
  }, 250);
});

engine.updateParams(store.getState().params);
engine.updateMuted(store.getState().muted);

document.addEventListener("visibilitychange", () => {
  engine.setVisibility(document.hidden);
});

if (motionQuery.addEventListener) {
  motionQuery.addEventListener("change", (event) => {
    store.setAnimationEnabled(!event.matches);
  });
}

window.addEventListener("keydown", (event) => {
  const target = event.target;

  if (target instanceof HTMLElement && target.closest("input, select, textarea, button")) {
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    void transport.togglePlayback();
  }

  if (event.key === "r" || event.key === "R") {
    store.randomize();

    if (!engine.isRunning) {
      void transport.togglePlayback();
    }
  }

  if (event.key === "m" || event.key === "M") {
    store.toggleMute();
  }
});

window.addEventListener("beforeunload", () => {
  store.persist();
});

if (!AudioEngine.isSupported()) {
  elements.startStop.disabled = true;
  elements.randomize.disabled = true;
  transport.setStatus("Web Audio API not supported");
}
