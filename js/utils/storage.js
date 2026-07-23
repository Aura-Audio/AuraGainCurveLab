import { STORAGE_KEY } from "../constants.js";

export function saveState(state) {
  try {
    const serializable = {
      params: state.params,
      activePresetId: state.activePresetId,
      muted: state.muted,
      animationEnabled: state.animationEnabled
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // Storage may be unavailable in private browsing or sandboxed contexts.
  }
}

export function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch {
    return null;
  }
}
