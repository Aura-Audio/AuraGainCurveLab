/**
 * Visualizer Module for GAIN CURVE LAB
 * Handles canvas drawing for scopes, ramp visualization, and UI updates.
 * @module visualizer
 */

import { dbToPct, WASM_CONFIG } from './wasm.js';
import { getAnalyserData, getDbValues, getCurrentGainPct, getCurrentPhase, isRunning } from './audio.js';

/**
 * Canvas elements
 */
let scopeBeforeCanvas = null;
let scopeAfterCanvas = null;
let rampCanvas = null;

/**
 * DOM elements for UI updates
 */
let barBeforeEl = null;
let barAfterEl = null;
let dbBeforeEl = null;
let dbAfterEl = null;
let deltaDbEl = null;
let gainPctEl = null;

/**
 * Animation frame handle
 */
let animHandle = null;

/**
 * Initialize visualizer with DOM elements
 * @param {Object} elements - DOM element references
 */
export function initVisualizer(elements) {
  scopeBeforeCanvas = elements.scopeBeforeCanvas;
  scopeAfterCanvas = elements.scopeAfterCanvas;
  rampCanvas = elements.rampCanvas;
  barBeforeEl = elements.barBefore;
  barAfterEl = elements.barAfter;
  dbBeforeEl = elements.dbBefore;
  dbAfterEl = elements.dbAfter;
  deltaDbEl = elements.deltaDb;
  gainPctEl = elements.gainPct;

  // Fit canvases to their containers
  fitAllCanvases();

  // Draw initial ramp
  drawRamp();

  // Start animation loop
  animate();
}

/**
 * Fit canvas to its container with proper DPI scaling
 * @param {HTMLCanvasElement} canvas - Canvas element to fit
 */
function fitCanvas(canvas) {
  if (!canvas) return;

  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, rect.width * ratio);
  canvas.height = Math.max(1, rect.height * ratio);
}

/**
 * Fit all canvases to their containers
 */
export function fitAllCanvases() {
  [scopeBeforeCanvas, scopeAfterCanvas, rampCanvas].forEach(fitCanvas);
}

/**
 * Draw the scope waveform on a canvas
 * @param {HTMLCanvasElement} canvas - Canvas element to draw on
 * @param {Uint8Array} byteData - Time domain data from analyser
 * @param {string} color - Color for the waveform
 */
function drawScope(canvas, byteData, color) {
  if (!canvas || !byteData) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const ratio = window.devicePixelRatio || 1;

  // Clear canvas
  ctx.clearRect(0, 0, w, h);

  // Draw center line
  ctx.strokeStyle = '#232830';
  ctx.lineWidth = 1 * ratio;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  // Draw waveform
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * ratio;
  ctx.beginPath();

  const slice = w / byteData.length;
  for (let i = 0; i < byteData.length; i++) {
    const v = byteData[i] / 128.0 - 1.0;
    const y = (h / 2) + v * (h / 2) * 0.9;
    const x = i * slice;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

/**
 * Draw the gain ramp visualization
 */
export function drawRamp() {
  if (!rampCanvas) return;

  const ctx = rampCanvas.getContext('2d');
  const w = rampCanvas.width;
  const h = rampCanvas.height;
  const ratio = window.devicePixelRatio || 1;

  // Clear canvas
  ctx.clearRect(0, 0, w, h);

  // Draw grid lines
  ctx.strokeStyle = '#3a4250';
  ctx.lineWidth = 1 * ratio;
  ctx.globalAlpha = 0.5;

  for (let gy = 0; gy <= 4; gy++) {
    const y = (h - 16 * ratio) - (gy / 4) * (h - 32 * ratio) + 8 * ratio;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

  // Draw ramp line (100% to 1%)
  ctx.strokeStyle = '#ff8a3d';
  ctx.lineWidth = 2.5 * ratio;
  ctx.beginPath();
  const top = 8 * ratio;
  const bottom = h - 16 * ratio;
  ctx.moveTo(0, top);
  ctx.lineTo(w, bottom);
  ctx.stroke();

  // Draw snap-back line
  ctx.setLineDash([4 * ratio, 4 * ratio]);
  ctx.strokeStyle = '#585f6b';
  ctx.beginPath();
  ctx.moveTo(w, bottom);
  ctx.lineTo(w, top);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw playhead
  let phase = 0;
  if (isRunning()) {
    phase = getCurrentPhase();
  }

  const px = phase * w;
  const py = top + phase * (bottom - top);

  // Vertical line
  ctx.strokeStyle = '#dbe2e8';
  ctx.lineWidth = 1 * ratio;
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, h);
  ctx.stroke();

  // Circle marker
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 4 * ratio, 0, Math.PI * 2);
  ctx.fill();

  // Labels
  ctx.fillStyle = '#6d7683';
  ctx.font = `${11 * ratio}px JetBrains Mono, monospace`;
  ctx.fillText('100%', 4 * ratio, 16 * ratio);
  ctx.fillText('1%', w - 28 * ratio, h - 6 * ratio);
}

/**
 * Update meter bars and readouts
 */
function updateMeters() {
  if (!barBeforeEl || !barAfterEl || !dbBeforeEl || !dbAfterEl || !deltaDbEl || !gainPctEl) return;

  const { dbBefore, dbAfter } = getDbValues();

  // Update bars
  barBeforeEl.style.width = `${dbToPct(dbBefore)}%`;
  barAfterEl.style.width = `${dbToPct(dbAfter)}%`;

  // Update readouts
  dbBeforeEl.textContent = dbBefore <= -79 ? '−∞' : dbBefore.toFixed(1);
  dbAfterEl.textContent = dbAfter <= -79 ? '−∞' : dbAfter.toFixed(1);

  // Update delta
  const delta = (dbBefore <= -79 || dbAfter <= -79) ? 0 : (dbBefore - dbAfter);
  deltaDbEl.textContent = `${delta.toFixed(1)} dB`;

  // Update gain percentage
  gainPctEl.textContent = `${getCurrentGainPct()}%`;
}

/**
 * Animation loop for continuous updates
 */
function animate() {
  // Update meters and scopes
  updateMeters();

  const { byteBefore, byteAfter } = getAnalyserData();

  // Draw scopes
  drawScope(scopeBeforeCanvas, byteBefore, '#4fd3c4');
  drawScope(scopeAfterCanvas, byteAfter, '#ff8a3d');

  // Draw ramp
  drawRamp();

  // Continue animation loop
  animHandle = requestAnimationFrame(animate);
}

/**
 * Pause the animation loop
 */
export function pauseAnimation() {
  if (animHandle) {
    cancelAnimationFrame(animHandle);
    animHandle = null;
  }
}

/**
 * Resume the animation loop
 */
export function resumeAnimation() {
  if (!animHandle) {
    animate();
  }
}

/**
 * Clean up visualizer resources
 */
export function cleanup() {
  pauseAnimation();

  scopeBeforeCanvas = null;
  scopeAfterCanvas = null;
  rampCanvas = null;
  barBeforeEl = null;
  barAfterEl = null;
  dbBeforeEl = null;
  dbAfterEl = null;
  deltaDbEl = null;
  gainPctEl = null;
}

// Handle window resize
window.addEventListener('resize', () => {
  fitAllCanvases();
  drawRamp();
});

export { animHandle };
