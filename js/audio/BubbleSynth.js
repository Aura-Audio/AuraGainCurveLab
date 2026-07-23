import { clamp } from "../utils/math.js";

function disconnectAll(nodes) {
  for (const node of nodes) {
    try {
      node.disconnect();
    } catch {
      // Ignore disconnect errors during cleanup.
    }
  }
}

function rampFrequency(param, from, to, startTime, endTime) {
  const safeFrom = Math.max(20, from);
  const safeTo = Math.max(20, to);

  param.setValueAtTime(safeFrom, startTime);

  if (Math.abs(safeTo - safeFrom) > 1) {
    param.exponentialRampToValueAtTime(safeTo, endTime);
  } else {
    param.setValueAtTime(safeTo, endTime);
  }
}

export function createBubbleVoice({
  audioCtx,
  destination,
  noiseBuffer,
  params,
  time,
  options = {}
}) {
  const nodes = [];
  const sources = [];

  let cleaned = false;
  let cleanupCallback = null;

  const track = (...audioNodes) => {
    nodes.push(...audioNodes);
    return audioNodes;
  };

  const sizeBase = params.size / 100;

  const size = clamp(
    sizeBase + (Math.random() - 0.5) * 0.55 + (options.sizeBias ?? 0),
    0.02,
    1
  );

  const duration = (0.035 + size * 0.32) * (0.75 + Math.random() * 0.5);

  const pitchVariance = 1 + (Math.random() * 2 - 1) * (params.pitchVar / 100);

  const frequency = clamp(
    params.basePitch * (1.35 - size * 0.95) * pitchVariance,
    30,
    6000
  );

  const bend = params.pitchBend + (Math.random() * 2 - 1) * 1.5;
  const bendRatio = Math.pow(2, bend / 12);

  const startFrequency = clamp(frequency / bendRatio, 25, 7000);
  const endFrequency = frequency;

  const wavePeakScale = params.wave === "sine" ? 1 : 0.55;
  const densityCompensation = 1 / Math.sqrt(1 + params.rate / 10);

  const peak =
    0.24 *
    densityCompensation *
    (0.45 + size * 0.55) *
    (options.gainScale ?? 1) *
    wavePeakScale;

  const attack = Math.min(0.02, 0.002 + size * 0.008);
  const cleanupTime = time + duration * 1.25 + 0.08;

  const bubbleBus = audioCtx.createGain();
  bubbleBus.gain.value = 1;

  const resonator = audioCtx.createBiquadFilter();
  resonator.type = "peaking";
  resonator.frequency.setValueAtTime(frequency, time);
  resonator.Q.value = params.resonance;
  resonator.gain.value = Math.min(12, params.resonance * 0.35);

  track(bubbleBus, resonator);

  bubbleBus.connect(resonator);

  if (audioCtx.createStereoPanner) {
    const panner = audioCtx.createStereoPanner();
    panner.pan.value = (Math.random() * 2 - 1) * (params.width / 100);

    resonator.connect(panner);
    panner.connect(destination);

    track(panner);
  } else {
    resonator.connect(destination);
  }

  const oscillator = audioCtx.createOscillator();
  oscillator.type = params.wave;

  rampFrequency(
    oscillator.frequency,
    startFrequency,
    endFrequency,
    time,
    time + duration * 0.65
  );

  const oscGain = audioCtx.createGain();
  oscGain.gain.setValueAtTime(0.0001, time);
  oscGain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), time + attack);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  oscillator.connect(oscGain);
  oscGain.connect(bubbleBus);

  track(oscillator, oscGain);
  sources.push(oscillator);

  oscillator.start(time);
  oscillator.stop(cleanupTime);

  if (size > 0.55) {
    const subOsc = audioCtx.createOscillator();
    subOsc.type = "sine";

    const subStart = Math.max(30, startFrequency / 2);
    const subEnd = Math.max(30, endFrequency / 2);

    rampFrequency(subOsc.frequency, subStart, subEnd, time, time + duration * 0.7);

    const subGain = audioCtx.createGain();
    const subAttackTime = time + Math.max(0.002, Math.min(attack * 1.4, duration * 0.6));
    const subEndTime = time + duration * 1.1;

    subGain.gain.setValueAtTime(0.0001, time);
    subGain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak * 0.5), subAttackTime);
    subGain.gain.exponentialRampToValueAtTime(0.0001, subEndTime);

    subOsc.connect(subGain);
    subGain.connect(bubbleBus);

    track(subOsc, subGain);
    sources.push(subOsc);

    subOsc.start(time);
    subOsc.stop(cleanupTime);
  }

  const noiseAmount = params.noise / 100;

  if (noiseAmount > 0.001 && noiseBuffer) {
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    noiseSource.playbackRate.value = 0.7 + Math.random() * 0.8;

    const bandpass = audioCtx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(
      clamp(frequency * (1.2 + Math.random() * 0.8), 80, 9000),
      time
    );
    bandpass.Q.value = params.resonance;

    const noiseGain = audioCtx.createGain();
    const noisePeak = Math.max(0.001, peak * noiseAmount * 0.9);

    const noiseAttackTime =
      time + Math.max(0.001, Math.min(attack * 0.7, duration * 0.4));

    const noiseEndTime =
      time + Math.max(noiseAttackTime + 0.01, Math.min(duration, 0.25));

    noiseGain.gain.setValueAtTime(0.0001, time);
    noiseGain.gain.exponentialRampToValueAtTime(noisePeak, noiseAttackTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, noiseEndTime);

    noiseSource.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(bubbleBus);

    track(noiseSource, bandpass, noiseGain);
    sources.push(noiseSource);

    noiseSource.start(time, Math.random() * 0.5);
    noiseSource.stop(cleanupTime);
  }

  const cleanup = () => {
    if (cleaned) {
      return;
    }

    cleaned = true;
    disconnectAll(nodes);

    if (cleanupCallback) {
      cleanupCallback();
    }
  };

  oscillator.onended = cleanup;

  return {
    size,
    sources,
    onCleanup(fn) {
      cleanupCallback = fn;
    },
    cancel: cleanup
  };
}
