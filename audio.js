/**
 * Audio Module for GAIN CURVE LAB
 * Handles Web Audio API setup, source management, and gain automation.
 * @module audio
 */

import { createNoiseBuffer, dbFromBuffer, WASM_CONFIG } from './wasm.js';

/**
 * Audio Context and Nodes
 */
let audioCtx = null;
let gainBeforeNode = null;
let analyserBefore = null;
let gainAfterNode = null;
let analyserAfter = null;
let monitorGainNode = null;
let sourceNode = null;
let micStream = null;

/**
 * Audio State
 */
let currentSourceType = 'tone';
let cycleDuration = 0.5;
let segmentT0 = 0;
let schedulerHandle = null;
let running = false;

/**
 * Buffer for analyser data
 */
const bufBefore = new Float32Array(WASM_CONFIG.BUFFER_SIZE);
const bufAfter = new Float32Array(WASM_CONFIG.BUFFER_SIZE);
const byteBefore = new Uint8Array(WASM_CONFIG.BUFFER_SIZE);
const byteAfter = new Uint8Array(WASM_CONFIG.BUFFER_SIZE);

/**
 * Minimum cycle duration to prevent audio thread overload
 */
const MIN_CYCLE_DURATION = 0.05;

/**
 * Ensure AudioContext is created
 * @returns {AudioContext} - The audio context
 */
export function ensureContext() {
  if (audioCtx) return audioCtx;
  
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  // Setup audio nodes
  gainBeforeNode = audioCtx.createGain();
  gainBeforeNode.gain.value = 1.0;
  
  analyserBefore = audioCtx.createAnalyser();
  analyserBefore.fftSize = WASM_CONFIG.BUFFER_SIZE;
  gainBeforeNode.connect(analyserBefore); // Metering only
  
  gainAfterNode = audioCtx.createGain();
  gainAfterNode.gain.value = 1.0;
  
  analyserAfter = audioCtx.createAnalyser();
  analyserAfter.fftSize = WASM_CONFIG.BUFFER_SIZE;
  
  monitorGainNode = audioCtx.createGain();
  monitorGainNode.gain.value = 0.35; // Default monitor volume
  
  gainAfterNode.connect(analyserAfter);
  analyserAfter.connect(monitorGainNode);
  monitorGainNode.connect(audioCtx.destination);
  
  return audioCtx;
}

/**
 * Connect an audio source
 * @param {string} type - Source type ('mic', 'tone', 'white', 'pink', 'brown')
 * @returns {Promise<boolean>} - Resolves with success status
 */
export async function connectSource(type) {
  // Validate source type
  const validSources = ['mic', 'tone', 'white', 'pink', 'brown'];
  if (!validSources.includes(type)) {
    console.error(`Invalid source type: ${type}`);
    return false;
  }
  
  disconnectSource();
  currentSourceType = type;
  
  try {
    ensureContext();
    
    if (type === 'mic') {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
        sourceNode = audioCtx.createMediaStreamSource(micStream);
      } catch (e) {
        console.error('Microphone access error:', e);
        throw new Error(`Microphone access was denied or is unavailable: ${e.message}`);
      }
    } else if (type === 'tone') {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine'; // Default waveform
      osc.frequency.value = 440; // Default frequency
      osc.start();
      sourceNode = osc;
    } else {
      // Noise types
      const buf = createNoiseBuffer(audioCtx, type);
      if (!buf) {
        throw new Error(`Failed to create ${type} noise buffer`);
      }
      const node = audioCtx.createBufferSource();
      node.buffer = buf;
      node.loop = true;
      node.start();
      sourceNode = node;
    }
    
    // Connect source to both paths
    sourceNode.connect(gainBeforeNode);
    sourceNode.connect(gainAfterNode);
    
    return true;
  } catch (err) {
    console.error('Failed to connect source:', err);
    disconnectSource();
    throw err;
  }
}

/**
 * Disconnect current audio source
 */
export function disconnectSource() {
  if (sourceNode) {
    try {
      sourceNode.disconnect();
    } catch (e) {
      console.warn('Error disconnecting source node:', e);
    }
    if (sourceNode.stop) {
      try {
        sourceNode.stop();
      } catch (e) {
        console.warn('Error stopping source node:', e);
      }
    }
    sourceNode = null;
  }
  
  if (micStream) {
    try {
      micStream.getTracks().forEach(track => track.stop());
    } catch (e) {
      console.warn('Error stopping microphone tracks:', e);
    }
    micStream = null;
  }
}

/**
 * Reset the gain ramp baseline
 */
export function resetRampBaseline() {
  if (!audioCtx) return;
  
  const now = audioCtx.currentTime;
  if (gainAfterNode) {
    gainAfterNode.gain.cancelScheduledValues(now);
    gainAfterNode.gain.setValueAtTime(1.0, now);
  }
  segmentT0 = now;
}

/**
 * Set the cycle duration for gain ramp
 * @param {number} duration - Cycle duration in seconds
 */
export function setCycleDuration(duration) {
  // Enforce minimum duration
  cycleDuration = Math.max(MIN_CYCLE_DURATION, parseFloat(duration));
  if (audioCtx) {
    resetRampBaseline();
  }
}

/**
 * Get current cycle duration
 * @returns {number} - Current cycle duration
 */
export function getCycleDuration() {
  return cycleDuration;
}

/**
 * Get current source type
 * @returns {string} - Current source type
 */
export function getCurrentSourceType() {
  return currentSourceType;
}

/**
 * Start the audio engine
 * @returns {Promise<boolean>} - Resolves with success status
 */
export async function startEngine() {
  if (running) return true;
  
  try {
    ensureContext();
    
    // Handle suspended context (common on mobile)
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    
    const success = await connectSource(currentSourceType);
    if (!success) return false;
    
    resetRampBaseline();
    running = true;
    
    // Start the scheduler
    schedulerTick();
    schedulerHandle = setInterval(schedulerTick, 25);
    
    return true;
  } catch (err) {
    console.error('Failed to start engine:', err);
    stopEngine();
    throw err;
  }
}

/**
 * Stop the audio engine
 */
export function stopEngine() {
  running = false;
  
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
  
  disconnectSource();
}

/**
 * Toggle engine state
 * @returns {Promise<boolean>} - Resolves with new running state
 */
export async function toggleEngine() {
  if (running) {
    stopEngine();
    return false;
  } else {
    const success = await startEngine();
    return success;
  }
}

/**
 * Is the engine running?
 * @returns {boolean} - Current running state
 */
export function isRunning() {
  return running;
}

/**
 * Get audio analyser data
 * @returns {Object} - Object containing analyser data
 */
export function getAnalyserData() {
  if (!audioCtx || !analyserBefore || !analyserAfter) {
    return {
      bufBefore: new Float32Array(0),
      bufAfter: new Float32Array(0),
      byteBefore: new Uint8Array(0),
      byteAfter: new Uint8Array(0)
    };
  }
  
  analyserBefore.getFloatTimeDomainData(bufBefore);
  analyserAfter.getFloatTimeDomainData(bufAfter);
  analyserBefore.getByteTimeDomainData(byteBefore);
  analyserAfter.getByteTimeDomainData(byteAfter);
  
  return {
    bufBefore,
    bufAfter,
    byteBefore,
    byteAfter
  };
}

/**
 * Calculate dB values from analyser data
 * @returns {Object} - Object containing dB values
 */
export function getDbValues() {
  const { bufBefore, bufAfter } = getAnalyserData();
  
  const dbB = dbFromBuffer(bufBefore, WASM_CONFIG.RMS_BEFORE_OFFSET);
  const dbA = dbFromBuffer(bufAfter, WASM_CONFIG.RMS_AFTER_OFFSET);
  
  return {
    dbBefore: dbB <= -79 ? -Infinity : dbB,
    dbAfter: dbA <= -79 ? -Infinity : dbA
  };
}

/**
 * Get current gain percentage based on cycle phase
 * @returns {number} - Current gain percentage (0-100)
 */
export function getCurrentGainPct() {
  if (!audioCtx || !running) return 100;
  
  const now = audioCtx.currentTime;
  const elapsed = (now - segmentT0) % cycleDuration;
  const phase = elapsed / cycleDuration;
  const gain = 1.0 + (0.01 - 1.0) * phase;
  
  return Math.round(gain * 100);
}

/**
 * Get the current phase of the gain cycle
 * @returns {number} - Phase (0-1)
 */
export function getCurrentPhase() {
  if (!audioCtx || !running) return 0;
  
  const now = audioCtx.currentTime;
  return ((now - segmentT0) % cycleDuration) / cycleDuration;
}

/**
 * Update oscillator properties (for tone source)
 * @param {string} waveform - Waveform type
 * @param {number} frequency - Frequency in Hz
 */
export function updateOscillator(waveform, frequency) {
  if (sourceNode && currentSourceType === 'tone' && sourceNode.type) {
    sourceNode.type = waveform;
    sourceNode.frequency.value = frequency;
  }
}

/**
 * Set monitor volume
 * @param {number} volume - Volume percentage (0-100)
 */
export function setMonitorVolume(volume) {
  const clampedVolume = Math.max(0, Math.min(100, volume));
  if (monitorGainNode) {
    monitorGainNode.gain.value = clampedVolume / 100;
  }
}

/**
 * Scheduler tick for gain automation
 */
function schedulerTick() {
  if (!audioCtx || !running) return;
  
  const lookahead = 0.25;
  const now = audioCtx.currentTime;
  
  // Calculate how many cycles have passed since segmentT0
  let n = Math.floor((now - segmentT0) / cycleDuration);
  let nextStart = segmentT0 + n * cycleDuration;
  
  // Schedule gain changes for upcoming cycles
  while (nextStart < now + lookahead) {
    if (nextStart >= now - 0.001) {
      if (gainAfterNode) {
        gainAfterNode.gain.setValueAtTime(1.0, nextStart);
        gainAfterNode.gain.linearRampToValueAtTime(0.01, nextStart + cycleDuration);
      }
    }
    nextStart += cycleDuration;
  }
}

/**
 * Clean up audio resources
 */
export function cleanup() {
  stopEngine();
  
  if (audioCtx) {
    try {
      audioCtx.close();
    } catch (e) {
      console.warn('Error closing audio context:', e);
    }
    audioCtx = null;
  }
  
  // Reset all nodes
  gainBeforeNode = null;
  analyserBefore = null;
  gainAfterNode = null;
  analyserAfter = null;
  monitorGainNode = null;
  sourceNode = null;
  micStream = null;
}

// Clean up on page unload
window.addEventListener('beforeunload', cleanup);

export {
  audioCtx,
  gainBeforeNode,
  analyserBefore,
  gainAfterNode,
  analyserAfter,
  monitorGainNode,
  sourceNode,
  micStream
};
