/**
 * Main Entry Point for GAIN CURVE LAB
 * Initializes the application and coordinates between modules.
 * @module main
 */

// Import the UI module
import { initUI, setStatus, showError } from './ui.js';

/**
 * Application state
 */
const appState = {
  initialized: false,
  initializationError: null
};

/**
 * Initialize the application
 */
async function initApp() {
  if (appState.initialized) return;

  try {
    // Set initial status
    setStatus('initializing...', false);

    // Initialize UI (which will load WASM and set up everything)
    await initUI();

    appState.initialized = true;
    appState.initializationError = null;

    console.log('GAIN CURVE LAB initialized successfully');
  } catch (err) {
    appState.initialized = false;
    appState.initializationError = err;

    console.error('Failed to initialize GAIN CURVE LAB:', err);
    setStatus('initialization failed', false);
    showError(`Failed to initialize application: ${err.message}`);

    // Show a user-friendly error message
    const errorContainer = document.createElement('div');
    errorContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff5c5c;
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      z-index: 1000;
      max-width: 80%;
    `;
    errorContainer.innerHTML = `
      <h2>Initialization Error</h2>
      <p>${err.message}</p>
      <p>Please refresh the page to try again.</p>
      <button onclick="this.parentElement.remove()" style="
        background: #1a1000;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 10px;
      ">Dismiss</button>
    `;
    document.body.appendChild(errorContainer);
  }
}

/**
 * Check if Web Audio API is supported
 * @returns {boolean} - True if Web Audio API is supported
 */
function checkWebAudioSupport() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      throw new Error('Web Audio API not supported in this browser');
    }

    // Test if we can create a context
    const testCtx = new AudioContext();
    testCtx.close();
    return true;
  } catch (e) {
    console.error('Web Audio API check failed:', e);
    return false;
  }
}

/**
 * Check if WebAssembly is supported
 * @returns {boolean} - True if WebAssembly is supported
 */
function checkWebAssemblySupport() {
  try {
    if (typeof WebAssembly === 'object' &&
        typeof WebAssembly.instantiate === 'function') {
      return true;
    }
    throw new Error('WebAssembly not supported');
  } catch (e) {
    console.error('WebAssembly check failed:', e);
    return false;
  }
}

/**
 * Show compatibility warning if required APIs are not supported
 */
function showCompatibilityWarning() {
  const unsupported = [];

  if (!checkWebAudioSupport()) {
    unsupported.push('Web Audio API');
  }

  if (!checkWebAssemblySupport()) {
    unsupported.push('WebAssembly');
  }

  if (unsupported.length > 0) {
    const warningContainer = document.createElement('div');
    warningContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff8a3d;
      color: #1a1000;
      padding: 15px;
      border-radius: 8px;
      max-width: 300px;
      z-index: 1000;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
    `;
    warningContainer.innerHTML = `
      <h3 style="margin: 0 0 10px 0;">⚠️ Compatibility Warning</h3>
      <p style="margin: 0;">The following features are not supported in your browser:</p>
      <ul style="margin: 10px 0; padding-left: 20px;">
        ${unsupported.map(feature => `<li>${feature}</li>`).join('')}
      </ul>
      <p style="margin: 0; font-size: 11px;">Some functionality may be limited.</p>
      <button onclick="this.parentElement.remove()" style="
        background: #1a1000;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 10px;
        font-family: inherit;
      ">Dismiss</button>
    `;
    document.body.appendChild(warningContainer);
  }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  showCompatibilityWarning();
  initApp();
});

// Export for debugging
window.GAIN_CURVE_LAB = {
  appState,
  initApp,
  checkWebAudioSupport,
  checkWebAssemblySupport
};
