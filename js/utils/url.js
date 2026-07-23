import { sanitizeParams } from "../config/presets.js";

const PARAM_KEY = "p";

export function serializeParams(params) {
  const sanitized = sanitizeParams(params);
  const json = JSON.stringify(sanitized);
  const base64 = window.btoa(encodeURIComponent(json));

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function deserializeParams(value) {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = decodeURIComponent(window.atob(padded));
    const parsed = JSON.parse(json);

    return sanitizeParams(parsed);
  } catch {
    return null;
  }
}

export function readParamsFromUrl() {
  try {
    const search = new URLSearchParams(window.location.search);
    const raw = search.get(PARAM_KEY);

    if (!raw) {
      return null;
    }

    return deserializeParams(raw);
  } catch {
    return null;
  }
}

export function updateUrl(params) {
  try {
    const encoded = serializeParams(params);
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM_KEY, encoded);
    window.history.replaceState(null, "", url.toString());
  } catch {
    // URL sharing is progressive enhancement only.
  }
}
