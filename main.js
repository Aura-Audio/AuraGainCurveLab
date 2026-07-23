/**
 * WASM Module for DSP (Digital Signal Processing)
 * Handles noise generation, RMS calculations, and other audio processing tasks.
 * @module wasm
 */

// WASM module (Base64 encoded)
const DSP_WASM_B64 = "AGFzbQEAAAABGQVgAXwBfGAAAX1gAX8AYAJ/fwBgAn9/AX0CCwEDZW52A2xvZwAAAwcGAQIDAwMEBQQBAQggBgkBfwFB5dCFKgsHPQYGbWVtb3J5AgAEc2VlZAACCWdlbl93aGl0ZQADCGdlbl9waW5rAAQJZ2VuX2Jyb3duAAUGcm1zX2RiAAYKmQQGOQEBfyMAIQAgACAAQQ10cyEAIAAgAEERdnMhACAAIABBBXRzIQAgACQAIACzQwAAADCUQwAAgD+TCwYAIAAkAAsrAQF/QQAhAgJAA0AgAiABTw0BIAAgAkEEbGoQATgCACACQQFqIQIMAAsLC9IBAgF/CX1BACECAkADQCACIAFPDQEQASEDIARDSrV/P5QgA0O9ZmM9lJIhBCAFQzhKfj+UIANDZcGZPZSSIQUgBkNiEHg/lCADQ2GLHT6UkiEGIAdD8tJdP5QgA0P4954+lJIhByAIQ83MDD+UIANDjm8IP5SSIQhDOPhCvyAJlCADQ61tijyUkyEJIAQgBZIgBpIgB5IgCJIgCZIgCpIgA0NnRAk/lJIhCyADQ5xq7T2UIQogACACQQRsaiALQ65H4T2UOAIAIAJBAWohAgwACwsgAyABuKMhBSAFnyEGIAZE8WjjiLX45D5lBH1DAACgwgVEAAAAAAAANEAgBhAARBZVtbuxawJAo6K2Cws=";

/**
 * WASM Memory Offsets (bytes)
 */
const WASM_CONFIG = {
  NOISE_OFFSET: 0,
  NOISE_CAPACITY: 100000,
  RMS_BEFORE_OFFSET: 400000,
  RMS_AFTER_OFFSET: 410000,
  SAMPLE_RATE: 44100,
  BUFFER_SIZE: 2048
};

/**
 * DSP Module Instance
 * @type {Object|null}
 */
let dsp = null;

/**
 * Convert Base64 to Uint8Array
 * @param {string} b64 - Base64 encoded string
 * @returns {Uint8Array} - Decoded bytes
 */
function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/**
 * Load and instantiate the WASM module
 * @returns {Promise<Object>} - Resolves with the WASM exports and memory
 */
export async function loadDspModule() {
  if (dsp) return dsp;

  try {
    const bytes = b64ToBytes(DSP_WASM_B64);
    const { instance } = await WebAssembly.instantiate(bytes, {
      env: {
        log: Math.log,
        // Add other imported functions if needed
      },
    });
    dsp = instance.exports;
    console.log("WASM module loaded successfully");
    return dsp;
  } catch (err) {
    console.error("Failed to load WASM module:", err);
    throw new Error("WASM module failed to load. Falling back to JavaScript implementations.");
  }
}

/**
 * Get the WASM module instance
 * @returns {Object|null} - The WASM exports and memory, or null if not loaded
 */
export function getDspModule() {
  return dsp;
}

/**
 * Generate noise buffer using WASM
 * @param {AudioContext} audioCtx - Web Audio API context
 * @param {string} type - Noise type ('white', 'pink', 'brown')
 * @returns {AudioBuffer|null} - Generated noise buffer or null if WASM not available
 */
export function createNoiseBuffer(audioCtx, type) {
  if (!dsp) {
    console.warn("WASM module not loaded. Cannot generate noise.");
    return null;
  }

  try {
    const len = Math.min(audioCtx.sampleRate * 2, WASM_CONFIG.NOISE_CAPACITY);
    const buffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    // Reseed for variety
    dsp.seed((Date.now() ^ (Math.random() * 0xffffffff)) | 0);

    // Generate noise based on type
    switch (type) {
      case 'white':
        dsp.gen_white(WASM_CONFIG.NOISE_OFFSET, len);
        break;
      case 'pink':
        dsp.gen_pink(WASM_CONFIG.NOISE_OFFSET, len);
        break;
      case 'brown':
        dsp.gen_brown(WASM_CONFIG.NOISE_OFFSET, len);
        break;
      default:
        console.warn(`Unknown noise type: ${type}. Defaulting to white noise.`);
        dsp.gen_white(WASM_CONFIG.NOISE_OFFSET, len);
    }

    // Copy from WASM memory to AudioBuffer
    const wasmView = new Float32Array(
      dsp.memory.buffer,
      WASM_CONFIG.NOISE_OFFSET,
      len
    );
    data.set(wasmView);
    return buffer;
  } catch (err) {
    console.error("Failed to create noise buffer:", err);
    return null;
  }
}

/**
 * Calculate RMS in dBFS from a Float32Array using WASM
 * @param {Float32Array} floatData - Audio sample data
 * @param {number} wasmOffset - Offset in WASM memory to use for scratch space
 * @returns {number} - RMS level in dBFS
 */
export function dbFromBuffer(floatData, wasmOffset) {
  if (!dsp) {
    console.warn("WASM module not loaded. Using fallback JS RMS calculation.");
    return calculateRmsJs(floatData);
  }

  try {
    const view = new Float32Array(
      dsp.memory.buffer,
      wasmOffset,
      floatData.length
    );
    view.set(floatData);
    return dsp.rms_db(wasmOffset, floatData.length);
  } catch (err) {
    console.error("WASM RMS calculation failed:", err);
    return calculateRmsJs(floatData);
  }
}

/**
 * Fallback JavaScript RMS to dBFS calculation
 * @param {Float32Array} floatData - Audio sample data
 * @returns {number} - RMS level in dBFS
 */
function calculateRmsJs(floatData) {
  let sum = 0;
  for (let i = 0; i < floatData.length; i++) {
    sum += floatData[i] * floatData[i];
  }
  const rms = Math.sqrt(sum / floatData.length);
  // Convert to dBFS (assuming max value is 1.0)
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
}

/**
 * Convert dB to percentage for UI display
 * @param {number} db - Decibel value
 * @returns {number} - Percentage (0-100)
 */
export function dbToPct(db) {
  const clamped = Math.max(-60, Math.min(0, db));
  return ((clamped + 60) / 60) * 100;
}

export { WASM_CONFIG };
