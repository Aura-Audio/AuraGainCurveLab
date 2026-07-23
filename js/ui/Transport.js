import { PRESETS } from "../config/presets.js";

export class Transport {
  constructor({ store, engine, elements }) {
    this.store = store;
    this.engine = engine;
    this.elements = elements;
    this.running = false;

    this.bind();

    this.unsubscribe = store.subscribe((state) => {
      this.renderState(state);
    });

    this.renderState(this.store.getState());
    this.setRunning(this.engine.isRunning);
  }

  bind() {
    this.elements.startStop.addEventListener("click", () => {
      void this.togglePlayback();
    });

    this.elements.randomize.addEventListener("click", () => {
      this.store.randomize();

      if (!this.engine.isRunning) {
        void this.togglePlayback();
      }
    });

    this.elements.mute.addEventListener("click", () => {
      this.store.toggleMute();
    });

    this.elements.reset.addEventListener("click", () => {
      this.store.reset();
    });

    this.elements.animationToggle.addEventListener("change", (event) => {
      this.store.setAnimationEnabled(event.target.checked);
    });
  }

  async togglePlayback() {
    try {
      if (this.engine.isRunning) {
        this.engine.stop();
        this.setRunning(false);
      } else {
        await this.engine.start();
        this.setRunning(true);
      }
    } catch (error) {
      console.error(error);
      this.setRunning(false);
      this.setStatus("Audio unavailable");
    }
  }

  setRunning(running) {
    this.running = running;

    this.elements.startStop.textContent = running ? "Stop" : "Start";
    this.elements.startStop.classList.toggle("playing", running);
    this.elements.startStop.setAttribute("aria-pressed", String(running));

    this.setStatus(running ? "Playing" : "Stopped");
  }

  setStatus(text) {
    this.elements.status.textContent = text;
  }

  renderState(state) {
    this.elements.mute.textContent = state.muted ? "Unmute" : "Mute";
    this.elements.mute.setAttribute("aria-pressed", String(state.muted));

    this.elements.animationToggle.checked = state.animationEnabled;

    const preset = PRESETS.find((item) => item.id === state.activePresetId);

    this.elements.presetName.textContent = preset
      ? `Preset: ${preset.label}`
      : "Preset: Custom";
  }

  destroy() {
    this.unsubscribe();
  }
}
