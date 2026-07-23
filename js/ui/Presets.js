import { PRESETS } from "../config/presets.js";
import { clearElement } from "./dom.js";

export class Presets {
  constructor({ store, root }) {
    this.store = store;
    this.root = root;
    this.buttons = new Map();

    this.build();

    this.unsubscribe = store.subscribe((state) => {
      this.render(state);
    });

    this.render(this.store.getState());
  }

  build() {
    clearElement(this.root);

    for (const preset of PRESETS) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = preset.label;
      button.dataset.preset = preset.id;

      button.addEventListener("click", () => {
        this.store.applyPreset(preset.id);
      });

      this.root.appendChild(button);
      this.buttons.set(preset.id, button);
    }
  }

  render(state) {
    for (const [id, button] of this.buttons) {
      button.classList.toggle("active", state.activePresetId === id);
    }
  }

  destroy() {
    this.unsubscribe();
  }
}
