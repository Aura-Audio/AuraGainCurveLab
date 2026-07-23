import { CONTROL_DEFS, WAVEFORMS } from "../config/presets.js";
import { clearElement } from "./dom.js";

export class Controls {
  constructor({ store, root }) {
    this.store = store;
    this.root = root;
    this.inputs = {};
    this.outputs = {};

    this.build();

    this.unsubscribe = store.subscribe((state) => {
      this.sync(state);
    });
  }

  build() {
    clearElement(this.root);

    for (const def of CONTROL_DEFS) {
      const control = document.createElement("div");
      control.className = "control";

      const label = document.createElement("label");
      label.htmlFor = def.id;

      const name = document.createElement("span");
      name.textContent = def.label;

      const output = document.createElement("output");
      output.id = `${def.id}-value`;
      output.textContent = def.format(this.store.getState().params[def.id]);

      label.append(name, output);

      const input = document.createElement("input");
      input.type = "range";
      input.id = def.id;
      input.min = String(def.min);
      input.max = String(def.max);
      input.step = String(def.step);
      input.value = String(this.store.getState().params[def.id]);

      input.addEventListener("input", () => {
        this.store.setParam(def.id, Number(input.value));
      });

      control.append(label, input);
      this.root.appendChild(control);

      this.inputs[def.id] = input;
      this.outputs[def.id] = output;
    }

    this.buildWaveControl();
    this.sync(this.store.getState());
  }

  buildWaveControl() {
    const control = document.createElement("div");
    control.className = "control";

    const label = document.createElement("label");
    label.htmlFor = "wave";

    const name = document.createElement("span");
    name.textContent = "Waveform";

    const output = document.createElement("output");
    output.id = "wave-value";

    label.append(name, output);

    const select = document.createElement("select");
    select.id = "wave";

    for (const wave of WAVEFORMS) {
      const option = document.createElement("option");
      option.value = wave;
      option.textContent = wave.charAt(0).toUpperCase() + wave.slice(1);
      select.appendChild(option);
    }

    select.addEventListener("change", () => {
      this.store.setParam("wave", select.value);
    });

    control.append(label, select);
    this.root.appendChild(control);

    this.inputs.wave = select;
    this.outputs.wave = output;
  }

  sync(state) {
    for (const def of CONTROL_DEFS) {
      const input = this.inputs[def.id];
      const output = this.outputs[def.id];

      if (!input || !output) {
        continue;
      }

      const value = state.params[def.id];

      if (document.activeElement !== input) {
        input.value = String(value);
      }

      output.textContent = def.format(value);
    }

    const waveInput = this.inputs.wave;
    const waveOutput = this.outputs.wave;

    if (waveInput && waveOutput) {
      if (document.activeElement !== waveInput) {
        waveInput.value = state.params.wave;
      }

      waveOutput.textContent = state.params.wave;
    }
  }

  destroy() {
    this.unsubscribe();
  }
}
