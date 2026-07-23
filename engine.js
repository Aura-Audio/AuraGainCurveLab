/**
 * Engine Module for GAIN CURVE LAB
 * An Engine is a single self-contained "track": one audio source run through
 * its own 100% -> minGain gain ramp, its own before/after analysers for
 * metering, and its own pan/mute. Many Engines share one AudioContext and
 * sum into a shared master bus, but each schedules and reports on itself.
 * @module engine
 */

import { createNoiseBuffer } from './wasm.js';

const CURVE_STEPS = 64;

/** Ease-out quadratic: fast initial drop, gentle tail into minGain. */
function buildEasedCurve(minGain) {
  const arr = new Float32Array(CURVE_STEPS);
  for (let i = 0; i < CURVE_STEPS; i++) {
    const t = i / (CURVE_STEPS - 1);
    const eased = Math.pow(1 - t, 2);
    arr[i] = minGain + (1 - minGain) * eased;
  }
  arr[0] = 1.0;
  arr[CURVE_STEPS - 1] = minGain;
  return arr;
}

/** Monotonic downward trend with fading jitter layered on top - a "glitchy" ramp. */
function buildRandomCurve(minGain, seed) {
  let s = seed >>> 0 || 1;
  const rand = () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  const arr = new Float32Array(CURVE_STEPS);
  for (let i = 0; i < CURVE_STEPS; i++) {
    const t = i / (CURVE_STEPS - 1);
    const trend = 1 + (minGain - 1) * t;
    const jitter = (rand() - 0.5) * 0.15 * (1 - t); // jitter fades out near cycle end
    arr[i] = Math.min(1, Math.max(minGain, trend + jitter));
  }
  arr[0] = 1.0;
  arr[CURVE_STEPS - 1] = minGain;
  return arr;
}

let engineIdCounter = 0;

export class Engine {
  /**
   * @param {AudioContext} audioCtx - shared context
   * @param {AudioNode} masterBus - shared summing bus all engines feed into
   * @param {Object} config
   * @param {number} [config.id]
   * @param {string} config.label
   * @param {'tone'|'white'|'pink'|'brown'} config.sourceType
   * @param {OscillatorType} [config.waveform]
   * @param {number} [config.frequency]
   * @param {number} config.cycleDuration - seconds per 100%->minGain->100% loop
   * @param {number} config.minGain - linear gain floor, e.g. 0.01 = 1%
   * @param {'linear'|'exponential'|'eased'|'random'} config.curve
   * @param {number} config.pan - -1..1
   */
  constructor(audioCtx, masterBus, config) {
    this.id = config.id ?? ++engineIdCounter;
    this.label = config.label || `ENGINE ${this.id}`;
    this.sourceType = config.sourceType;
    this.waveform = config.waveform || 'sine';
    this.frequency = config.frequency || 440;
    this.cycleDuration = config.cycleDuration;
    this.minGain = config.minGain;
    this.curve = config.curve;
    this.pan = config.pan;
    this.muted = false;

    this.audioCtx = audioCtx;
    this.segmentT0 = 0;
    this.sourceNode = null;

    // ---- Per-track node graph ----
    this.gainBefore = audioCtx.createGain();
    this.gainBefore.gain.value = 1.0;
    this.analyserBefore = audioCtx.createAnalyser();
    this.analyserBefore.fftSize = 1024;
    this.gainBefore.connect(this.analyserBefore); // metering only - never reaches the bus

    this.gainAfter = audioCtx.createGain();
    this.gainAfter.gain.value = 1.0;
    this.analyserAfter = audioCtx.createAnalyser();
    this.analyserAfter.fftSize = 1024;

    this.panNode = audioCtx.createStereoPanner();
    this.panNode.pan.value = this.pan;

    // Fixed per-track trim so ~20 concurrent tracks don't automatically clip;
    // the shared compressor (see audio.js) is a second line of defense.
    this.trimGain = audioCtx.createGain();
    this.trimGain.gain.value = 0.18;

    this.muteGain = audioCtx.createGain();
    this.muteGain.gain.value = 1.0;

    this.gainAfter.connect(this.analyserAfter);
    this.analyserAfter.connect(this.panNode);
    this.panNode.connect(this.trimGain);
    this.trimGain.connect(this.muteGain);
    this.muteGain.connect(masterBus);

    // Curve types that aren't native AudioParam ramps get a precomputed shape.
    this._curveArray =
      this.curve === 'eased' ? buildEasedCurve(this.minGain) :
      this.curve === 'random' ? buildRandomCurve(this.minGain, this.id * 2654435761) :
      null;

    // Per-engine scratch buffers, reused every animation frame.
    this.bufBefore = new Float32Array(1024);
    this.bufAfter = new Float32Array(1024);
    this.byteBefore = new Uint8Array(1024);
    this.byteAfter = new Uint8Array(1024);
  }

  /** Create and start this track's source node, resetting its ramp baseline. */
  start() {
    this.stop();

    if (this.sourceType === 'tone') {
      const osc = this.audioCtx.createOscillator();
      osc.type = this.waveform;
      osc.frequency.value = this.frequency;
      osc.start();
      this.sourceNode = osc;
    } else {
      const buf = createNoiseBuffer(this.audioCtx, this.sourceType);
      const node = this.audioCtx.createBufferSource();
      node.buffer = buf;
      node.loop = true;
      node.start();
      this.sourceNode = node;
    }

    this.sourceNode.connect(this.gainBefore);
    this.sourceNode.connect(this.gainAfter);

    const now = this.audioCtx.currentTime;
    this.gainAfter.gain.cancelScheduledValues(now);
    this.gainAfter.gain.setValueAtTime(1.0, now);
    this.segmentT0 = now;
  }

  /** Stop and disconnect this track's source node. */
  stop() {
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (e) { /* already disconnected */ }
      if (this.sourceNode.stop) {
        try { this.sourceNode.stop(); } catch (e) { /* already stopped */ }
      }
      this.sourceNode = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    this.muteGain.gain.value = muted ? 0 : 1;
  }

  /** Schedule this track's own ramp cycle(s) within the lookahead window. */
  scheduleTick(lookahead) {
    if (!this.sourceNode) return;
    const now = this.audioCtx.currentTime;
    let n = Math.floor((now - this.segmentT0) / this.cycleDuration);
    let nextStart = this.segmentT0 + n * this.cycleDuration;

    while (nextStart < now + lookahead) {
      if (nextStart >= now - 0.001) {
        const endTime = nextStart + this.cycleDuration;
        if (this.curve === 'linear') {
          this.gainAfter.gain.setValueAtTime(1.0, nextStart);
          this.gainAfter.gain.linearRampToValueAtTime(this.minGain, endTime);
        } else if (this.curve === 'exponential') {
          this.gainAfter.gain.setValueAtTime(1.0, nextStart);
          this.gainAfter.gain.exponentialRampToValueAtTime(this.minGain, endTime);
        } else {
          // eased / random: precomputed shape stretched across this cycle
          this.gainAfter.gain.setValueCurveAtTime(this._curveArray, nextStart, this.cycleDuration);
        }
      }
      nextStart += this.cycleDuration;
    }
  }

  /** Current phase (0-1) through this track's own cycle. */
  getPhase() {
    if (!this.sourceNode) return 0;
    const now = this.audioCtx.currentTime;
    return ((now - this.segmentT0) % this.cycleDuration) / this.cycleDuration;
  }

  /** Current applied gain (0-1), exact for every curve type - used for readouts. */
  getCurrentGain() {
    if (!this.sourceNode) return 1.0;
    const phase = this.getPhase();
    if (this.curve === 'linear') return 1.0 + (this.minGain - 1.0) * phase;
    if (this.curve === 'exponential') return Math.pow(this.minGain, phase);
    const arr = this._curveArray;
    const idx = Math.min(arr.length - 1, Math.floor(phase * (arr.length - 1)));
    return arr[idx];
  }

  /** Sample this frame's shape at a given phase (0-1) - used to draw the ramp curve. */
  sampleCurveAt(phase) {
    if (this.curve === 'linear') return 1.0 + (this.minGain - 1.0) * phase;
    if (this.curve === 'exponential') return Math.pow(this.minGain, phase);
    const arr = this._curveArray;
    const idx = Math.min(arr.length - 1, Math.floor(phase * (arr.length - 1)));
    return arr[idx];
  }

  /** Pull the latest analyser data into this engine's own scratch buffers. */
  readMeters() {
    this.analyserBefore.getFloatTimeDomainData(this.bufBefore);
    this.analyserAfter.getFloatTimeDomainData(this.bufAfter);
    this.analyserBefore.getByteTimeDomainData(this.byteBefore);
    this.analyserAfter.getByteTimeDomainData(this.byteAfter);
  }
}
