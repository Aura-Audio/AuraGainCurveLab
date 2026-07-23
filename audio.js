/**
 * Audio Module for GAIN CURVE LAB
 * Manages the shared AudioContext and master bus, and owns the rack of
 * Engine instances (one per track). Previously this module wrapped a single
 * scaler; that scaler is now the Engine class (see engine.js), and this
 * module's job is to build, run, and report on many of them at once.
 * @module audio
 */

import { Engine } from './engine.js';
import { dbFromBuffer, WASM_CONFIG } from './wasm.js';

/**
 * Shared audio graph
 */
let audioCtx = null;
let masterBus = null;
let compressor = null;
let monitorGainNode = null;

/**
 * Rack state
 */
let engines = [];
let schedulerHandle = null;
let running = false;
let inspectedId = 1;

/**
 * 20 distinct track configurations. Each varies source/waveform/frequency,
 * cycle duration, gain floor, ramp curve shape, and stereo position, so no
 * two engines behave or sound alike.
 */
export const RACK_CONFIGS = [
  { id: 1,  label: 'T-01 SINE 110',    sourceType: 'tone',  waveform: 'sine',     frequency: 110,  cycleDuration: 2.0,  minGain: 0.01,  curve: 'linear',      pan: -1.0 },
  { id: 2,  label: 'T-02 SINE 165',    sourceType: 'tone',  waveform: 'sine',     frequency: 165,  cycleDuration: 1.0,  minGain: 0.01,  curve: 'exponential', pan: -0.9 },
  { id: 3,  label: 'T-03 SQUARE 220',  sourceType: 'tone',  waveform: 'square',   frequency: 220,  cycleDuration: 0.5,  minGain: 0.05,  curve: 'linear',      pan: -0.8 },
  { id: 4,  label: 'T-04 SQUARE 330',  sourceType: 'tone',  waveform: 'square',   frequency: 330,  cycleDuration: 0.25, minGain: 0.05,  curve: 'eased',       pan: -0.7 },
  { id: 5,  label: 'T-05 SAW 275',     sourceType: 'tone',  waveform: 'sawtooth', frequency: 275,  cycleDuration: 0.75, minGain: 0.02,  curve: 'linear',      pan: -0.6 },
  { id: 6,  label: 'T-06 SAW 440',     sourceType: 'tone',  waveform: 'sawtooth', frequency: 440,  cycleDuration: 1.5,  minGain: 0.02,  curve: 'exponential', pan: -0.5 },
  { id: 7,  label: 'T-07 TRI 330',     sourceType: 'tone',  waveform: 'triangle', frequency: 330,  cycleDuration: 0.1,  minGain: 0.1,   curve: 'linear',      pan: -0.4 },
  { id: 8,  label: 'T-08 TRI 550',     sourceType: 'tone',  waveform: 'triangle', frequency: 550,  cycleDuration: 0.4,  minGain: 0.1,   curve: 'eased',       pan: -0.3 },
  { id: 9,  label: 'N-09 WHITE',       sourceType: 'white', cycleDuration: 1.0,  minGain: 0.01,  curve: 'linear',      pan: -0.2 },
  { id: 10, label: 'N-10 WHITE FAST',  sourceType: 'white', cycleDuration: 0.05, minGain: 0.01,  curve: 'random',      pan: -0.1 },
  { id: 11, label: 'N-11 PINK',        sourceType: 'pink',  cycleDuration: 1.5,  minGain: 0.01,  curve: 'exponential', pan: 0.0  },
  { id: 12, label: 'N-12 PINK QUICK',  sourceType: 'pink',  cycleDuration: 0.3,  minGain: 0.05,  curve: 'linear',      pan: 0.1  },
  { id: 13, label: 'N-13 BROWN',       sourceType: 'brown', cycleDuration: 2.0,  minGain: 0.01,  curve: 'eased',       pan: 0.2  },
  { id: 14, label: 'N-14 BROWN SHY',   sourceType: 'brown', cycleDuration: 0.6,  minGain: 0.2,   curve: 'linear',      pan: 0.3  },
  { id: 15, label: 'T-15 SINE 660',    sourceType: 'tone',  waveform: 'sine',     frequency: 660,  cycleDuration: 0.15, minGain: 0.01,  curve: 'random',      pan: 0.4  },
  { id: 16, label: 'T-16 SINE 880 SLOW', sourceType: 'tone', waveform: 'sine',   frequency: 880,  cycleDuration: 3.0,  minGain: 0.005, curve: 'linear',      pan: 0.5  },
  { id: 17, label: 'T-17 SQUARE 110',  sourceType: 'tone',  waveform: 'square',   frequency: 110,  cycleDuration: 0.5,  minGain: 0.01,  curve: 'exponential', pan: 0.6  },
  { id: 18, label: 'T-18 SAW 660',     sourceType: 'tone',  waveform: 'sawtooth', frequency: 660,  cycleDuration: 0.2,  minGain: 0.03,  curve: 'eased',       pan: 0.7  },
  { id: 19, label: 'T-19 TRI 220',     sourceType: 'tone',  waveform: 'triangle', frequency: 220,  cycleDuration: 1.0,  minGain: 0.01,  curve: 'linear',      pan: 0.8  },
  { id: 20, label: 'N-20 PINK GLITCH', sourceType: 'pink',  cycleDuration: 0.08, minGain: 0.01,  curve: 'random',      pan: 1.0  }
];

/**
 * Ensure the shared AudioContext + master bus exist.
 * @returns {AudioContext}
 */
export function ensureContext() {
  if (audioCtx) return audioCtx;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  masterBus = audioCtx.createGain();
  masterBus.gain.value = 1.0;

  // Soft limiter: 20 concurrent tracks summed can clip even with per-track
  // trim, so a gentle compressor sits between the bus and the listener.
  compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 20;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  monitorGainNode = audioCtx.createGain();
  monitorGainNode.gain.value = 0.35;

  masterBus.connect(compressor);
  compressor.connect(monitorGainNode);
  monitorGainNode.connect(audioCtx.destination);

  return audioCtx;
}

/**
 * Build the 20-engine rack (idempotent - safe to call more than once).
 * @returns {Engine[]}
 */
export function buildRack() {
  if (engines.length) return engines;
  ensureContext();
  engines = RACK_CONFIGS.map(cfg => new Engine(audioCtx, masterBus, cfg));
  return engines;
}

export function getEngines() {
  return engines;
}

export function getEngine(id) {
  return engines.find(e => e.id === id) || null;
}

export function getInspectedEngine() {
  return getEngine(inspectedId) || engines[0] || null;
}

export function setInspectedEngine(id) {
  if (getEngine(id)) inspectedId = id;
}

export function setEngineMuted(id, muted) {
  const eng = getEngine(id);
  if (eng) eng.setMuted(muted);
}

/**
 * Set the overall monitor (listening) volume - safety control, independent
 * of each track's own gain ramp.
 * @param {number} volume - 0-100
 */
export function setMonitorVolume(volume) {
  const clamped = Math.max(0, Math.min(100, volume));
  if (monitorGainNode) monitorGainNode.gain.value = clamped / 100;
}

export function isRunning() {
  return running;
}

/**
 * Start every engine in the rack and the shared scheduler.
 * @returns {Promise<boolean>}
 */
export async function startAll() {
  if (running) return true;

  try {
    ensureContext();
    buildRack();

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    engines.forEach(e => e.start());
    running = true;

    schedulerTick();
    schedulerHandle = setInterval(schedulerTick, 25);

    return true;
  } catch (err) {
    console.error('Failed to start rack:', err);
    stopAll();
    throw err;
  }
}

/** Stop every engine in the rack and the shared scheduler. */
export function stopAll() {
  running = false;

  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }

  engines.forEach(e => e.stop());
}

/**
 * @returns {Promise<boolean>} new running state
 */
export async function toggleAll() {
  if (running) {
    stopAll();
    return false;
  }
  return await startAll();
}

/** One shared scheduler tick drives all 20 engines - not 20 separate timers. */
function schedulerTick() {
  if (!running) return;
  const lookahead = 0.25;
  engines.forEach(e => e.scheduleTick(lookahead));
}

/**
 * Read and compute meter data for a single engine, for the animation loop.
 * @param {number} id
 */
export function getEngineMeterData(id) {
  const eng = getEngine(id);
  if (!eng) return null;

  eng.readMeters();
  const dbBefore = dbFromBuffer(eng.bufBefore, WASM_CONFIG.RMS_BEFORE_OFFSET);
  const dbAfter = dbFromBuffer(eng.bufAfter, WASM_CONFIG.RMS_AFTER_OFFSET);

  return {
    dbBefore: dbBefore <= -79 ? -Infinity : dbBefore,
    dbAfter: dbAfter <= -79 ? -Infinity : dbAfter,
    gainPct: Math.round(eng.getCurrentGain() * 100),
    phase: eng.getPhase(),
    byteBefore: eng.byteBefore,
    byteAfter: eng.byteAfter
  };
}

/** Clean up all audio resources (called on page unload). */
export function cleanup() {
  stopAll();

  if (audioCtx) {
    try { audioCtx.close(); } catch (e) { /* already closed */ }
    audioCtx = null;
  }

  masterBus = null;
  compressor = null;
  monitorGainNode = null;
  engines = [];
}

window.addEventListener('beforeunload', cleanup);
