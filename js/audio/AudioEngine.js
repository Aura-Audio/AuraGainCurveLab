import { Scheduler } from "./Scheduler.js";
import { createBubbleVoice } from "./BubbleSynth.js";
import { clamp } from "../utils/math.js";
import { poissonInterval } from "../utils/random.js";

export class AudioEngine {
  constructor({ initialParams, onBubbleScheduled }) {
    this.params = { ...initialParams };
    this.muted = false;
    this.onBubbleScheduled = onBubbleScheduled;

    this.audioCtx = null;
    this.master = null;
    this.lowpass = null;
    this.compressor = null;
    this.noiseBuffer = null;

    this.running = false;
    this.nextBubbleTime = 0;
    this.lookahead = 0.12;

    this.activeVoices = 0;
    this.maxVoices = 48;
    this.activeVoiceHandles = new Set();

    this.scheduler = new Scheduler({
      intervalMs: 25,
      onTick: () => this.schedulerTick()
    });
  }

  get isRunning() {
    return this.running;
  }

  static isSupported() {
    return Boolean(window.AudioContext || window.webkitAudioContext);
  }

  updateParams(params) {
    this.params = { ...params };

    if (this.audioCtx) {
      this.updateMuffle();
      this.updateMaster();
    }
  }

  updateMuted(muted) {
    this.muted = Boolean(muted);

    if (this.audioCtx) {
      this.updateMaster();
    }
  }

  async start() {
    if (this.running) {
      return;
    }

    if (!AudioEngine.isSupported()) {
      throw new Error("Web Audio API is not supported in this browser.");
    }

    if (!this.audioCtx) {
      this.initAudio();
    }

    try {
      await this.audioCtx.resume();
    } catch (error) {
      this.running = false;
      throw error;
    }

    this.running = true;
    this.nextBubbleTime = this.audioCtx.currentTime + 0.06;

    this.updateMaster();
    this.scheduler.start();
  }

  stop() {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.scheduler.stop();

    if (this.audioCtx && this.master) {
      const now = this.audioCtx.currentTime;

      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(0, now, 0.04);

      this.stopAllVoices(now + 0.12);
    }
  }

  setVisibility(hidden) {
    this.lookahead = hidden ? 1.2 : 0.12;
  }

  getCurrentTime() {
    return this.audioCtx ? this.audioCtx.currentTime : performance.now() / 1000;
  }

  initAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    this.audioCtx = new AudioContextClass();

    this.master = this.audioCtx.createGain();
    this.master.gain.value = 0;

    this.lowpass = this.audioCtx.createBiquadFilter();
    this.lowpass.type = "lowpass";
    this.lowpass.frequency.value = 14000;
    this.lowpass.Q.value = 0.6;

    this.compressor = this.audioCtx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-24, this.audioCtx.currentTime);
    this.compressor.knee.setValueAtTime(30, this.audioCtx.currentTime);
    this.compressor.ratio.setValueAtTime(12, this.audioCtx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.audioCtx.currentTime);

    this.master.connect(this.lowpass);
    this.lowpass.connect(this.compressor);
    this.compressor.connect(this.audioCtx.destination);

    const length = this.audioCtx.sampleRate;
    this.noiseBuffer = this.audioCtx.createBuffer(1, length, this.audioCtx.sampleRate);

    const data = this.noiseBuffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    this.updateMuffle();
  }

  schedulerTick() {
    if (!this.running || !this.audioCtx) {
      return;
    }

    const now = this.audioCtx.currentTime;

    if (this.nextBubbleTime < now - 0.25) {
      this.nextBubbleTime = now + 0.05;
    }

    while (this.nextBubbleTime < now + this.lookahead) {
      this.scheduleEvent(this.nextBubbleTime);

      const interval = poissonInterval(this.params.rate);
      this.nextBubbleTime += clamp(interval, 0.018, 2.5);
    }
  }

  scheduleEvent(time) {
    if (this.muted || this.params.volume <= 0) {
      return;
    }

    const clusterChance =
      (this.params.clustering / 100) *
      0.4 *
      Math.max(0.2, 1 - this.params.rate / 40);

    if (Math.random() < clusterChance) {
      const count = 2 + Math.floor(Math.random() * 2);

      for (let i = 0; i < count; i += 1) {
        const offset = i * (0.02 + Math.random() * 0.055);

        this.scheduleBubble(time + offset, {
          sizeBias: -0.1 - Math.random() * 0.2,
          gainScale: 0.65
        });
      }
    } else {
      this.scheduleBubble(time);
    }
  }

  scheduleBubble(time, options = {}) {
    if (!this.audioCtx || this.activeVoices >= this.maxVoices) {
      return;
    }

    let voice;

    try {
      voice = createBubbleVoice({
        audioCtx: this.audioCtx,
        destination: this.master,
        noiseBuffer: this.noiseBuffer,
        params: this.params,
        time,
        options
      });
    } catch (error) {
      console.error("Failed to create bubble voice.", error);
      return;
    }

    const handle = {
      sources: voice.sources,
      cancel: voice.cancel
    };

    this.activeVoiceHandles.add(handle);
    this.activeVoices += 1;

    voice.onCleanup(() => {
      this.activeVoiceHandles.delete(handle);
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    });

    if (this.onBubbleScheduled) {
      this.onBubbleScheduled(time, voice.size);
    }
  }

  stopAllVoices(stopTime) {
    const handles = [...this.activeVoiceHandles];

    for (const handle of handles) {
      for (const source of handle.sources) {
        try {
          source.stop(stopTime);
        } catch {
          // Ignore source stop errors.
        }
      }

      handle.cancel();
    }
  }

  updateMaster() {
    if (!this.audioCtx || !this.master) {
      return;
    }

    const target =
      this.running && !this.muted ? (this.params.volume / 100) * 0.85 : 0;

    this.master.gain.setTargetAtTime(target, this.audioCtx.currentTime, 0.03);
  }

  updateMuffle() {
    if (!this.audioCtx || !this.lowpass) {
      return;
    }

    const amount = this.params.muffle / 100;
    const frequency = 20000 * Math.pow(500 / 20000, amount);

    this.lowpass.frequency.setTargetAtTime(frequency, this.audioCtx.currentTime, 0.03);
  }
}
