/**
 * UI Module for GAIN CURVE LAB
 * Handles user interactions, UI state, and DOM updates.
 * @module ui
 */

import {
  connectSource,
  setCycleDuration,
  getCycleDuration,
  getCurrentSourceType,
  toggleEngine,
  isRunning,
  setMonitorVolume,
  setCurrentGainPct,
  updateOscillator,
  cleanup as cleanupAudio
} from './audio.js';

import { fitAllCanvases, drawRamp, pauseAnimation, resumeAnimation, cleanup as cleanupVisualizer } from './visualizer.js';

/**
 * DOM Elements
 */
const elements = {
  sourceButtons: null,
  toneControls: null,
  durationButtons: null,
  playBtn: null,
  statusText: null,
  monitorSlider: null,
  monitorVal: null,
  freqSlider: null,
  freqVal: null,
  waveformSelect: null,
  errorMessage: null,
  scopeBeforeCanvas: null,
  scopeAfterCanvas: null,
  rampCanvas: null,
  barBefore: null,
  barAfter: null,
  dbBefore: null,
  dbAfter: null,
  deltaDb: null,
  gainPct: null
};

/**
 * UI State
 */
let uiState = {
  wasmReady: false,
  wasmLoading: false,
  wasmError: null
};

/**
 * Initialize UI module
 */
export async function initUI() {
  // Cache DOM elements
  cacheDomElements();
  
  // Setup event listeners
  setupEventListeners();
  
  // Load WASM module
  await loadWasmModule();
  
  // Initialize visualizer
  initVisualizer();
  
  // Fit canvases
  fitAllCanvases();
  drawRamp();
}

/**
 * Cache all DOM elements
 */
function cacheDomElements() {
  elements.sourceButtons = document.getElementById('sourceButtons');
  elements.toneControls = document.getElementById('toneControls');
  elements.durationButtons = document.getElementById('durationButtons');
  elements.playBtn = document.getElementById('playBtn');
  elements.statusText = document.getElementById('statusText');
  elements.monitorSlider = document.getElementById('monitorSlider');
  elements.monitorVal = document.getElementById('monitorVal');
  elements.freqSlider = document.getElementById('freqSlider');
  elements.freqVal = document.getElementById('freqVal');
  elements.waveformSelect = document.getElementById('waveformSelect');
  elements.errorMessage = document.getElementById('errorMessage');
  elements.scopeBeforeCanvas = document.getElementById('scopeBefore');
  elements.scopeAfterCanvas = document.getElementById('scopeAfter');
  elements.rampCanvas = document.getElementById('rampCanvas');
  elements.barBefore = document.getElementById('barBefore');
  elements.barAfter = document.getElementById('barAfter');
  elements.dbBefore = document.getElementById('dbBefore');
  elements.dbAfter = document.getElementById('dbAfter');
  elements.deltaDb = document.getElementById('deltaDb');
  elements.gainPct = document.getElementById('gainPct');
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Source buttons
  if (elements.sourceButtons) {
    elements.sourceButtons.addEventListener('click', handleSourceButtonClick);
  }
  
  // Duration buttons
  if (elements.durationButtons) {
    elements.durationButtons.addEventListener('click', handleDurationButtonClick);
  }
  
  // Play button
  if (elements.playBtn) {
    elements.playBtn.addEventListener('click', handlePlayButtonClick);
  }
  
  // Monitor slider
  if (elements.monitorSlider) {
    elements.monitorSlider.addEventListener('input', handleMonitorSliderInput);
  }
  
  // Frequency slider
  if (elements.freqSlider) {
    elements.freqSlider.addEventListener('input', handleFreqSliderInput);
  }
  
  // Waveform select
  if (elements.waveformSelect) {
    elements.waveformSelect.addEventListener('change', handleWaveformChange);
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * Load WASM module
 */
async function loadWasmModule() {
  if (uiState.wasmReady || uiState.wasmLoading) return;
  
  uiState.wasmLoading = true;
  setStatus('loading WASM...', false);
  
  try {
    // Load WASM module (imported from main.js)
    if (window.loadDspModule) {
      await window.loadDspModule();
    }
    uiState.wasmReady = true;
    uiState.wasmError = null;
    setStatus('idle · wasm ready', false);
  } catch (err) {
    uiState.wasmReady = false;
    uiState.wasmError = err;
    console.error('WASM loading error:', err);
    setStatus('idle · wasm failed (JS fallback active)', false);
    showError('WASM module failed to load. Using JavaScript fallback.');
  } finally {
    uiState.wasmLoading = false;
  }
}

/**
 * Initialize visualizer with DOM elements
 */
function initVisualizer() {
  import('./visualizer.js').then(({ initVisualizer }) => {
    initVisualizer(elements);
  }).catch(err => {
    console.error('Failed to initialize visualizer:', err);
    showError('Visualizer initialization failed.');
  });
}

/**
 * Handle source button click
 * @param {Event} e - Click event
 */
async function handleSourceButtonClick(e) {
  const btn = e.target.closest('button[data-source]');
  if (!btn) return;
  
  const source = btn.dataset.source;
  
  // Validate source
  const validSources = ['mic', 'tone', 'white', 'pink', 'brown'];
  if (!validSources.includes(source)) {
    showError(`Invalid source: ${source}`);
    return;
  }
  
  // Update active button
  updateActiveButton(elements.sourceButtons, btn);
  
  // Show/hide tone controls
  toggleToneControls(source === 'tone');
  
  // If running, switch source
  if (isRunning()) {
    try {
      await connectSource(source);
      setStatus(`running · ${source}`, true);
    } catch (err) {
      showError(err.message);
      // Revert to previous source
      const currentSource = getCurrentSourceType();
      updateActiveButton(elements.sourceButtons, 
        elements.sourceButtons.querySelector(`button[data-source="${currentSource}"]`));
    }
  }
}

/**
 * Handle duration button click
 * @param {Event} e - Click event
 */
function handleDurationButtonClick(e) {
  const btn = e.target.closest('button[data-dur]');
  if (!btn) return;
  
  const duration = parseFloat(btn.dataset.dur);
  
  // Validate duration
  if (isNaN(duration) || duration <= 0) {
    showError(`Invalid duration: ${btn.dataset.dur}`);
    return;
  }
  
  // Update active button
  updateActiveButton(elements.durationButtons, btn);
  
  // Set duration
  setCycleDuration(duration);
}

/**
 * Handle play button click
 */
async function handlePlayButtonClick() {
  try {
    const newRunningState = await toggleEngine();
    
    if (newRunningState) {
      elements.playBtn.textContent = '■ STOP ENGINE';
      elements.playBtn.classList.add('on');
      setStatus(`running · ${getCurrentSourceType()}`, true);
      resumeAnimation();
    } else {
      elements.playBtn.textContent = '▶ START ENGINE';
      elements.playBtn.classList.remove('on');
      setStatus('idle', false);
      pauseAnimation();
    }
  } catch (err) {
    showError(err.message);
    console.error('Play button error:', err);
  }
}

/**
 * Handle monitor slider input
 */
function handleMonitorSliderInput() {
  if (!elements.monitorSlider || !elements.monitorVal) return;
  
  const volume = parseInt(elements.monitorSlider.value);
  elements.monitorVal.textContent = `${volume}%`;
  setMonitorVolume(volume);
}

/**
 * Handle frequency slider input
 */
function handleFreqSliderInput() {
  if (!elements.freqSlider || !elements.freqVal) return;
  
  const freq = parseInt(elements.freqSlider.value);
  elements.freqVal.textContent = `${freq} Hz`;
  
  // Update oscillator if tone is active
  if (getCurrentSourceType() === 'tone' && elements.waveformSelect) {
    updateOscillator(elements.waveformSelect.value, freq);
  }
}

/**
 * Handle waveform select change
 */
function handleWaveformChange() {
  if (!elements.waveformSelect) return;
  
  const waveform = elements.waveformSelect.value;
  
  // Update oscillator if tone is active
  if (getCurrentSourceType() === 'tone' && elements.freqSlider) {
    updateOscillator(waveform, parseInt(elements.freqSlider.value));
  }
}

/**
 * Handle keyboard shortcuts
 * @param {KeyboardEvent} e - Keydown event
 */
function handleKeyDown(e) {
  // Ignore if typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  
  // Space: Toggle play/pause
  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    handlePlayButtonClick();
  }
  
  // M: Toggle microphone
  if (e.key === 'm' || e.key === 'M') {
    const micBtn = elements.sourceButtons?.querySelector('button[data-source="mic"]');
    if (micBtn) {
      micBtn.click();
    }
  }
  
  // T: Toggle tone
  if (e.key === 't' || e.key === 'T') {
    const toneBtn = elements.sourceButtons?.querySelector('button[data-source="tone"]');
    if (toneBtn) {
      toneBtn.click();
    }
  }
}

/**
 * Update active button in a button set
 * @param {HTMLElement} container - Container element
 * @param {HTMLElement} activeBtn - Button to mark as active
 */
function updateActiveButton(container, activeBtn) {
  if (!container) return;
  
  container.querySelectorAll('.btn').forEach(btn => {
    btn.classList.remove('active');
  });
  activeBtn.classList.add('active');
}

/**
 * Toggle tone controls visibility
 * @param {boolean} show - Whether to show tone controls
 */
function toggleToneControls(show) {
  if (elements.toneControls) {
    elements.toneControls.classList.toggle('hidden', !show);
  }
}

/**
 * Set status text
 * @param {string} text - Status text
 * @param {boolean} live - Whether status is live
 */
export function setStatus(text, live) {
  if (elements.statusText) {
    elements.statusText.innerHTML = '<span class="dot"></span>' + text;
    elements.statusText.classList.toggle('live', live);
  }
}

/**
 * Show error message
 * @param {string} message - Error message
 */
export function showError(message) {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message;
    // Clear after 5 seconds
    setTimeout(() => {
      if (elements.errorMessage) {
        elements.errorMessage.textContent = '';
      }
    }, 5000);
  }
  console.error('Error:', message);
}

/**
 * Clean up UI resources
 */
export function cleanup() {
  cleanupAudio();
  cleanupVisualizer();
  
  // Remove event listeners
  if (elements.sourceButtons) {
    elements.sourceButtons.removeEventListener('click', handleSourceButtonClick);
  }
  if (elements.durationButtons) {
    elements.durationButtons.removeEventListener('click', handleDurationButtonClick);
  }
  if (elements.playBtn) {
    elements.playBtn.removeEventListener('click', handlePlayButtonClick);
  }
  if (elements.monitorSlider) {
    elements.monitorSlider.removeEventListener('input', handleMonitorSliderInput);
  }
  if (elements.freqSlider) {
    elements.freqSlider.removeEventListener('input', handleFreqSliderInput);
  }
  if (elements.waveformSelect) {
    elements.waveformSelect.removeEventListener('change', handleWaveformChange);
  }
  
  document.removeEventListener('keydown', handleKeyDown);
}

// Clean up on page unload
window.addEventListener('beforeunload', cleanup);

export { elements, uiState };
