# AuraGainCurveLab

20-engine gain curve demonstration rack. Each engine applies a unique mathematical gain curve to an audio source (tone, microphone, or noise) and visualizes the result in real time.

## Architecture
- `wasm.js` — DSP module with WASM + JS fallback
- `gain-curves.js` — 20 unique curve definitions
- `engine.js` — Self-contained `AudioEngine` class per track
- `visualizer.js` — Canvas drawing utilities
- `main.js` — Engine manager & UI generator
- `index.html` + `styles.css` — Grid layout

## Running
Serve the directory with any static file server (e.g. `npx serve .` or `python -m http.server`) and open in a modern browser.

## WASM Fallback
If the embedded WASM module fails to instantiate, the app automatically falls back to JavaScript implementations for noise generation (white/pink/brown) and RMS calculation. No functionality is lost.
