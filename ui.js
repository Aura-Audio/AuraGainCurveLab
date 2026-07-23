/**
 * UI Module for GAIN CURVE LAB
 * Builds the 20-track rack, wires user interaction, and reports status.
 * @module ui
 */

import { loadDspModule } from './wasm.js';
import {
  RACK_CONFIGS,
  buildRack,
  toggleAll,
  isRunning,
  setMonitorVolume,
  setEngineMuted,
  setInspectedEngine,
  cleanup as cleanupAudio
} from './audio.js';
import {
  initVisualizer,
  fitAllCanvases,
  drawRamp,
  pauseAnimation,
  resumeAnimation,
  cleanup as cleanupVisualizer
} from './visualizer.js';

const elements = {
  playBtn: null,
  statusText: null,
  monitorSlider: null,
  monitorVal: null,
  errorMessage: null,
  trackRack: null,
  scopeBeforeCanvas: null,
  scopeAfterCanvas: null,
  rampCanvas: null,
  detailBarBefore: null,
  detailBarAfter: null,
  detailDbBefore: null,
  detailDbAfter: null,
  detailDeltaDb: null,
  detailGainPct: null,
  detailLabel: null
};

/** One entry per track row, handed to the visualizer for live updates. */
const trackRows = [];

let wasmReady = false;

export async function initUI() {
  cacheDomElements();
  buildTrackRows();
  setupEventListeners();
  await loadWasmModule();

  initVisualizer({
    trackRows,
    scopeBeforeCanvas: elements.scopeBeforeCanvas,
    scopeAfterCanvas: elements.scopeAfterCanvas,
    rampCanvas: elements.rampCanvas,
    detailBarBefore: elements.detailBarBefore,
    detailBarAfter: elements.detailBarAfter,
    detailDbBefore: elements.detailDbBefore,
    detailDbAfter: elements.detailDbAfter,
    detailDeltaDb: elements.detailDeltaDb,
    detailGainPct: elements.detailGainPct,
    detailLabel: elements.detailLabel
  });
}

function cacheDomElements() {
  elements.playBtn = document.getElementById('playBtn');
  elements.statusText = document.getElementById('statusText');
  elements.monitorSlider = document.getElementById('monitorSlider');
  elements.monitorVal = document.getElementById('monitorVal');
  elements.errorMessage = document.getElementById('errorMessage');
  elements.trackRack = document.getElementById('trackRack');
  elements.scopeBeforeCanvas = document.getElementById('scopeBefore');
  elements.scopeAfterCanvas = document.getElementById('scopeAfter');
  elements.rampCanvas = document.getElementById('rampCanvas');
  elements.detailBarBefore = document.getElementById('detailBarBefore');
  elements.detailBarAfter = document.getElementById('detailBarAfter');
  elements.detailDbBefore = document.getElementById('detailDbBefore');
  elements.detailDbAfter = document.getElementById('detailDbAfter');
  elements.detailDeltaDb = document.getElementById('detailDeltaDb');
  elements.detailGainPct = document.getElementById('detailGainPct');
  elements.detailLabel = document.getElementById('detailLabel');
}

/** Build one compact row per engine config and inject them into the rack. */
function buildTrackRows() {
  if (!elements.trackRack) return;

  RACK_CONFIGS.forEach((cfg, index) => {
    const row = document.createElement('div');
    row.className = 'track-row' + (index === 0 ? ' inspected' : '');
    row.dataset.id = String(cfg.id);

    const sourceTag = cfg.sourceType === 'tone'
      ? `${cfg.waveform} ${cfg.frequency}Hz`
      : `${cfg.sourceType} noise`;

    row.innerHTML = `
      <div class="track-label">
        <span class="track-name">${cfg.label}</span>
        <span class="track-tag">${sourceTag} · ${cfg.cycleDuration}s · ${cfg.curve}</span>
      </div>
      <div class="track-meters">
        <div class="db-bar-track mini before"><div class="db-bar-fill" data-role="barBefore"></div></div>
        <div class="db-bar-track mini after"><div class="db-bar-fill" data-role="barAfter"></div></div>
      </div>
      <div class="track-gain" data-role="gainPct">100%</div>
      <button class="mute-btn" type="button" data-role="muteBtn" title="Mute this track">M</button>
    `;

    const barBefore = row.querySelector('[data-role="barBefore"]');
    const barAfter = row.querySelector('[data-role="barAfter"]');
    const gainPct = row.querySelector('[data-role="gainPct"]');
    const muteBtn = row.querySelector('[data-role="muteBtn"]');

    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const muted = !muteBtn.classList.contains('muted');
      muteBtn.classList.toggle('muted', muted);
      setEngineMuted(cfg.id, muted);
    });

    row.addEventListener('click', () => {
      elements.trackRack.querySelectorAll('.track-row').forEach(r => r.classList.remove('inspected'));
      row.classList.add('inspected');
      setInspectedEngine(cfg.id);
    });

    elements.trackRack.appendChild(row);
    trackRows.push({ id: cfg.id, barBefore, barAfter, gainPct });
  });
}

function setupEventListeners() {
  if (elements.playBtn) elements.playBtn.addEventListener('click', handlePlayButtonClick);
  if (elements.monitorSlider) elements.monitorSlider.addEventListener('input', handleMonitorSliderInput);
  document.addEventListener('keydown', handleKeyDown);
}

async function loadWasmModule() {
  setStatus('loading WASM...', false);
  try {
    await loadDspModule();
    wasmReady = true;
    setStatus('idle · wasm ready', false);
  } catch (err) {
    wasmReady = false;
    console.error('WASM loading error:', err);
    setStatus('idle · wasm failed (JS fallback active)', false);
    showError('WASM module failed to load. Using JavaScript fallback.');
  }
}

async function handlePlayButtonClick() {
  try {
    if (!isRunning()) buildRack(); // ensure engines exist before first start
    const newRunningState = await toggleAll();

    if (newRunningState) {
      elements.playBtn.textContent = '■ STOP ALL';
      elements.playBtn.classList.add('on');
      setStatus('running · 20 engines', true);
      resumeAnimation();
    } else {
      elements.playBtn.textContent = '▶ START ALL';
      elements.playBtn.classList.remove('on');
      setStatus('idle', false);
    }
  } catch (err) {
    showError(err.message);
    console.error('Play button error:', err);
  }
}

function handleMonitorSliderInput() {
  if (!elements.monitorSlider || !elements.monitorVal) return;
  const volume = parseInt(elements.monitorSlider.value, 10);
  elements.monitorVal.textContent = `${volume}%`;
  setMonitorVolume(volume);
}

function handleKeyDown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    handlePlayButtonClick();
  }
}

export function setStatus(text, live) {
  if (elements.statusText) {
    elements.statusText.innerHTML = '<span class="dot"></span>' + text;
    elements.statusText.classList.toggle('live', !!live);
  }
}

export function showError(message) {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message;
    setTimeout(() => {
      if (elements.errorMessage) elements.errorMessage.textContent = '';
    }, 5000);
  }
  console.error('Error:', message);
}

export function cleanup() {
  cleanupAudio();
  cleanupVisualizer();
  if (elements.playBtn) elements.playBtn.removeEventListener('click', handlePlayButtonClick);
  if (elements.monitorSlider) elements.monitorSlider.removeEventListener('input', handleMonitorSliderInput);
  document.removeEventListener('keydown', handleKeyDown);
}

window.addEventListener('beforeunload', cleanup);

export { elements };
