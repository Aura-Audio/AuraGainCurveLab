import { saveState } from "../utils/storage.js";
import {
  DEFAULT_PARAMS,
  DEFAULT_PRESET_ID,
  getPreset,
  randomParams,
  sanitizeParams
} from "../config/presets.js";

export class Store {
  constructor(initialState = {}) {
    const defaultState = {
      params: { ...DEFAULT_PARAMS },
      activePresetId: DEFAULT_PRESET_ID,
      muted: false,
      animationEnabled: true
    };

    this.state = {
      ...defaultState,
      ...initialState,
      params: sanitizeParams(initialState.params ?? defaultState.params)
    };

    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  setState(partial, options = {}) {
    const { save = true } = options;

    this.state = {
      ...this.state,
      ...partial,
      params: sanitizeParams({
        ...this.state.params,
        ...(partial.params ?? {})
      })
    };

    this.emit();

    if (save) {
      this.persist();
    }
  }

  setParam(id, value) {
    this.setState({
      params: {
        ...this.state.params,
        [id]: value
      },
      activePresetId: null
    });
  }

  applyPreset(id) {
    const preset = getPreset(id);

    if (!preset) {
      return;
    }

    this.setState({
      params: { ...preset.params },
      activePresetId: id
    });
  }

  randomize() {
    this.setState({
      params: randomParams(),
      activePresetId: null
    });
  }

  reset() {
    this.applyPreset(DEFAULT_PRESET_ID);
  }

  toggleMute() {
    this.setState({
      muted: !this.state.muted
    });
  }

  setMuted(muted) {
    this.setState({
      muted: Boolean(muted)
    });
  }

  setAnimationEnabled(enabled) {
    this.setState({
      animationEnabled: Boolean(enabled)
    });
  }

  persist() {
    saveState(this.state);
  }

  emit() {
    for (const listener of [...this.listeners]) {
      listener(this.state);
    }
  }
}
