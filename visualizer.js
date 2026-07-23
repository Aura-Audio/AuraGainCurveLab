/**
 * Visualizer Module for GAIN CURVE LAB
 * Draws the compact per-track meters for all 20 engines, plus a detailed
 * before/after scope + ramp-curve view for whichever engine is "inspected".
 * @module visualizer
 */

import { dbToPct } from './wasm.js';
import {
  getEngineMeterData,
  getInspectedEngine,
  isRunning
} from './audio.js';

let trackRows = [];      // [{ id, barBefore, barAfter, gainPct }]
let scopeBeforeCanvas = null;
let scopeAfterCanvas = null;
let rampCanvas = null;
let detailBarBefore = null;
let detailBarAfter = null;
let detailDbBefore = null;
let detailDbAfter = null;
let detailDeltaDb = null;
let detailGainPct = null;
let detailLabel = null;

let animHandle = null;

/**
 * Initialize visualizer with DOM references built by ui.js.
 * @param {Object} refs
 * @param {Array} refs.trackRows
 * @param {HTMLCanvasElement} refs.scopeBeforeCanvas
 * @param {HTMLCanvasElement} refs.scopeAfterCanvas
 * @param {HTMLCanvasElement} refs.rampCanvas
 * @param {HTMLElement} refs.detailBarBefore
 * @param {HTMLElement} refs.detailBarAfter
 * @param {HTMLElement} refs.detailDbBefore
 * @param {HTMLElement} refs.detailDbAfter
 * @param {HTMLElement} refs.detailDeltaDb
 * @param {HTMLElement} refs.detailGainPct
 * @param {HTMLElement} refs.detailLabel
 */
export function initVisualizer(refs) {
  trackRows = refs.trackRows || [];
  scopeBeforeCanvas = refs.scopeBeforeCanvas;
  scopeAfterCanvas = refs.scopeAfterCanvas;
  rampCanvas = refs.rampCanvas;
  detailBarBefore = refs.detailBarBefore;
  detailBarAfter = refs.detailBarAfter;
  detailDbBefore = refs.detailDbBefore;
  detailDbAfter = refs.detailDbAfter;
  detailDeltaDb = refs.detailDeltaDb;
  detailGainPct = refs.detailGainPct;
  detailLabel = refs.detailLabel;

  fitAllCanvases();
  drawRamp();
  animate();
}

function fitCanvas(canvas) {
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, rect.width * ratio);
  canvas.height = Math.max(1, rect.height * ratio);
}

export function fitAllCanvases() {
  [scopeBeforeCanvas, scopeAfterCanvas, rampCanvas].forEach(fitCanvas);
}

function drawScope(canvas, byteData, color) {
  if (!canvas || !byteData) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const ratio = window.devicePixelRatio || 1;

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#232830';
  ctx.lineWidth = 1 * ratio;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * ratio;
  ctx.beginPath();
  const slice = w / byteData.length;
  for (let i = 0; i < byteData.length; i++) {
    const v = byteData[i] / 128.0 - 1.0;
    const y = (h / 2) + v * (h / 2) * 0.9;
    const x = i * slice;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/**
 * Draw the gain-ramp curve for the inspected engine (shape depends on its
 * own curve type: linear / exponential / eased / random), plus a live
 * playhead. The bottom label reflects that engine's actual gain floor,
 * since it differs per track (0.5% to 20% across the rack).
 */
export function drawRamp() {
  if (!rampCanvas) return;
  const ctx = rampCanvas.getContext('2d');
  const w = rampCanvas.width, h = rampCanvas.height;
  const ratio = window.devicePixelRatio || 1;

  ctx.clearRect(0, 0, w, h);

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

  const eng = getInspectedEngine();
  const top = 8 * ratio;
  const bottom = h - 16 * ratio;
  const minGain = eng ? eng.minGain : 0.01;

  // Plot the actual per-engine curve shape as a polyline.
  ctx.strokeStyle = '#ff8a3d';
  ctx.lineWidth = 2.5 * ratio;
  ctx.beginPath();
  const STEPS = 80;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const gain = eng ? eng.sampleCurveAt(t) : (1 + (0.01 - 1) * t);
    // Map gain (1.0 -> minGain) onto the vertical axis (top -> bottom).
    const norm = (1.0 - gain) / (1.0 - minGain);
    const y = top + norm * (bottom - top);
    const x = t * w;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.setLineDash([4 * ratio, 4 * ratio]);
  ctx.strokeStyle = '#585f6b';
  ctx.beginPath();
  ctx.moveTo(w, bottom);
  ctx.lineTo(w, top);
  ctx.stroke();
  ctx.setLineDash([]);

  const phase = (eng && isRunning()) ? eng.getPhase() : 0;
  const px = phase * w;
  const gainNow = eng ? eng.sampleCurveAt(phase) : 1.0;
  const py = top + ((1.0 - gainNow) / (1.0 - minGain)) * (bottom - top);

  ctx.strokeStyle = '#dbe2e8';
  ctx.lineWidth = 1 * ratio;
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, h);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 4 * ratio, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#6d7683';
  ctx.font = `${11 * ratio}px JetBrains Mono, monospace`;
  ctx.fillText('100%', 4 * ratio, 16 * ratio);
  ctx.fillText(`${(minGain * 100).toFixed(minGain < 0.01 ? 2 : 1)}%`, w - 40 * ratio, h - 6 * ratio);
}

/** Update the compact meter row for every engine in the rack. */
function updateTrackRows() {
  for (const row of trackRows) {
    const data = getEngineMeterData(row.id);
    if (!data) continue;
    row.barBefore.style.width = `${dbToPct(data.dbBefore)}%`;
    row.barAfter.style.width = `${dbToPct(data.dbAfter)}%`;
    row.gainPct.textContent = `${data.gainPct}%`;
  }
}

/** Update the detail panel for whichever engine is currently inspected. */
function updateDetail() {
  const eng = getInspectedEngine();
  if (!eng || !detailBarBefore) return;

  const data = getEngineMeterData(eng.id);
  if (!data) return;

  detailBarBefore.style.width = `${dbToPct(data.dbBefore)}%`;
  detailBarAfter.style.width = `${dbToPct(data.dbAfter)}%`;
  detailDbBefore.textContent = data.dbBefore <= -79 ? '−∞' : data.dbBefore.toFixed(1);
  detailDbAfter.textContent = data.dbAfter <= -79 ? '−∞' : data.dbAfter.toFixed(1);

  const delta = (data.dbBefore <= -79 || data.dbAfter <= -79) ? 0 : (data.dbBefore - data.dbAfter);
  detailDeltaDb.textContent = `${delta.toFixed(1)} dB`;
  detailGainPct.textContent = `${data.gainPct}%`;
  if (detailLabel) detailLabel.textContent = `${eng.label} · ${eng.curve} · ${eng.cycleDuration}s`;

  drawScope(scopeBeforeCanvas, data.byteBefore, '#4fd3c4');
  drawScope(scopeAfterCanvas, data.byteAfter, '#ff8a3d');
}

function animate() {
  updateTrackRows();
  updateDetail();
  drawRamp();
  animHandle = requestAnimationFrame(animate);
}

export function pauseAnimation() {
  if (animHandle) {
    cancelAnimationFrame(animHandle);
    animHandle = null;
  }
}

export function resumeAnimation() {
  if (!animHandle) animate();
}

export function cleanup() {
  pauseAnimation();
  trackRows = [];
  scopeBeforeCanvas = null;
  scopeAfterCanvas = null;
  rampCanvas = null;
  detailBarBefore = null;
  detailBarAfter = null;
  detailDbBefore = null;
  detailDbAfter = null;
  detailDeltaDb = null;
  detailGainPct = null;
  detailLabel = null;
}

window.addEventListener('resize', () => {
  fitAllCanvases();
  drawRamp();
});
