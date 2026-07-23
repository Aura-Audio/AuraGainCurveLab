/**
 * Main Entry — 20-Engine Rack with Master Controls
 */

import { ENGINE_CONFIGS } from './gain-curves.js';
import { AudioEngine } from './engine.js';
import { loadDspModule } from './wasm.js';
import { fitCanvas, drawScope, drawCurvePreview, drawPlayhead } from './visualizer.js';

const app = {
  engines: [],
  audioCtx: null,
  masterGain: null,
  animHandle: null,
  initialized: false
};

async function init() {
  if (app.initialized) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    alert('Web Audio API is not supported in this browser.');
    return;
  }

  app.audioCtx = new AudioContext();

  // Master gain for overall app volume
  app.masterGain = app.audioCtx.createGain();
  app.masterGain.gain.value = 0.8;
  app.masterGain.connect(app.audioCtx.destination);

  // Attempt WASM load (non-blocking)
  try { await loadDspModule(); } catch (e) {
    console.warn('WASM optional load failed:', e);
  }

  const grid = document.getElementById('engineGrid');

  ENGINE_CONFIGS.forEach(config => {
    const engine = new AudioEngine(config, app.audioCtx);
    engine.connectToDestination(app.masterGain);
    app.engines.push(engine);

    const card = buildCard(engine);
    grid.appendChild(card);

    const preview = card.querySelector('.curve-preview');
    drawCurvePreview(preview, config.curve, config.color);
  });

  setupMasterControls();

  window.addEventListener('resize', () => {
    app.engines.forEach(en => {
      const card = document.querySelector(`.engine-card[data-id="${en.id}"]`);
      if (card) {
        const preview = card.querySelector('.curve-preview');
        const scope = card.querySelector('.engine-scope');
        fitCanvas(preview);
        fitCanvas(scope);
        drawCurvePreview(preview, en.config.curve, en.config.color);
      }
    });
  });

  animate();
  app.initialized = true;
  updateGlobalStatus('Idle · 20 engines ready');
  console.log('AuraGainCurveLab — 20 engines ready');
}

function setupMasterControls() {
  // Start All
  document.getElementById('startAllBtn').addEventListener('click', async () => {
    updateGlobalStatus('Starting all engines...');
    let started = 0;
    for (const en of app.engines) {
      if (!en.running) {
        try {
          await en.start();
          updatePlayButton(en.id, true);
          started++;
        } catch (err) {
          console.warn(`Engine ${en.id} failed to start:`, err.message);
        }
      }
    }
    updateGlobalStatus(`${started} engine(s) running`);
  });

  // Stop All
  document.getElementById('stopAllBtn').addEventListener('click', () => {
    app.engines.forEach(en => {
      en.stop();
      updatePlayButton(en.id, false);
    });
    updateGlobalStatus('All engines stopped');
  });

  // Master Source
  document.getElementById('masterSource').addEventListener('change', e => {
    const type = e.target.value;
    app.engines.forEach(en => {
      en.setSource(type).catch(err => console.warn(err.message));
      // Update card UI
      const card = document.querySelector(`.engine-card[data-id="${en.id}"]`);
      if (card) {
        const sel = card.querySelector('.engine-source');
        if (sel) sel.value = type;
      }
    });
  });

  // Master Duration
  document.getElementById('masterDuration').addEventListener('change', e => {
    const dur = parseFloat(e.target.value);
    app.engines.forEach(en => {
      en.setCycleDuration(dur);
      const card = document.querySelector(`.engine-card[data-id="${en.id}"]`);
      if (card) {
        const sel = card.querySelector('.engine-dur');
        if (sel) sel.value = dur;
      }
    });
  });

  // Master Monitor Volume (per-engine)
  document.getElementById('masterMonitorVol').addEventListener('input', e => {
    const vol = parseInt(e.target.value);
    document.getElementById('masterMonitorVal').textContent = `${vol}%`;
    app.engines.forEach(en => {
      en.setMonitorVolume(vol);
      const card = document.querySelector(`.engine-card[data-id="${en.id}"]`);
      if (card) {
        const slider = card.querySelector('.engine-vol');
        if (slider) slider.value = vol;
      }
    });
  });

  // Master App Volume (overall)
  document.getElementById('masterAppVol').addEventListener('input', e => {
    const vol = parseInt(e.target.value);
    document.getElementById('masterAppVal').textContent = `${vol}%`;
    if (app.masterGain) {
      app.masterGain.gain.value = vol / 100;
    }
  });
}

function updateGlobalStatus(text) {
  const el = document.getElementById('globalStatus');
  if (el) el.textContent = text;
}

function buildCard(engine) {
  const div = document.createElement('div');
  div.className = 'engine-card';
  div.dataset.id = engine.id;

  div.innerHTML = `
    <div class="engine-header" style="border-color:${engine.color}">
      <div>
        <div class="engine-num">#${String(engine.id).padStart(2, '0')}</div>
        <div class="engine-name">${engine.name}</div>
        <div class="engine-tag">${engine.tag}</div>
      </div>
      <button class="engine-playbtn" data-id="${engine.id}" title="Start/Stop engine">▶</button>
    </div>
    <canvas class="curve-preview" width="300" height="60"></canvas>
    <div class="engine-scope-wrap">
      <canvas class="engine-scope" id="scope-${engine.id}" width="300" height="80"></canvas>
    </div>
    <div class="engine-controls">
      <select class="engine-source" data-id="${engine.id}">
        <option value="tone" selected>Tone</option>
        <option value="mic">Mic</option>
        <option value="white">White</option>
        <option value="pink">Pink</option>
        <option value="brown">Brown</option>
      </select>
      <select class="engine-dur" data-id="${engine.id}">
        <option value="2">2 s</option>
        <option value="1">1 s</option>
        <option value="0.5" selected>0.5 s</option>
        <option value="0.1">0.1 s</option>
        <option value="0.05">0.05 s</option>
      </select>
      <input type="range" class="engine-vol" data-id="${engine.id}" min="0" max="100" value="20" title="Monitor volume">
    </div>
    <div class="engine-readout">
      <span>Gain: <b class="gain-pct" style="color:${engine.color}">100%</b></span>
      <span>Δ dB: <b class="delta-db">0.0</b></span>
    </div>
  `;

  const playBtn = div.querySelector('.engine-playbtn');
  playBtn.addEventListener('click', async () => {
    if (engine.running) {
      engine.stop();
      updatePlayButton(engine.id, false);
    } else {
      try {
        await engine.start();
        updatePlayButton(engine.id, true);
      } catch (err) {
        alert(`Engine ${engine.id}: ${err.message}`);
      }
    }
  });

  const sourceSel = div.querySelector('.engine-source');
  sourceSel.addEventListener('change', e => {
    engine.setSource(e.target.value).catch(err => alert(err.message));
  });

  const durSel = div.querySelector('.engine-dur');
  durSel.addEventListener('change', e => {
    engine.setCycleDuration(parseFloat(e.target.value));
  });

  const volSlider = div.querySelector('.engine-vol');
  volSlider.addEventListener('input', e => {
    engine.setMonitorVolume(parseInt(e.target.value));
  });

  return div;
}

function updatePlayButton(id, running) {
  const btn = document.querySelector(`.engine-playbtn[data-id="${id}"]`);
  if (!btn) return;
  btn.textContent = running ? '■' : '▶';
  btn.classList.toggle('running', running);
}

function animate() {
  app.engines.forEach(engine => {
    const card = document.querySelector(`.engine-card[data-id="${engine.id}"]`);
    if (!card) return;

    const preview = card.querySelector('.curve-preview');
    const scope = card.querySelector('.engine-scope');

    drawCurvePreview(preview, engine.gainCurve, engine.color);
    drawPlayhead(preview, engine.getCurrentPhase(), engine.gainCurve, engine.color);

    if (engine.running) {
      const { byteAfter } = engine.getAnalyserData();
      drawScope(scope, byteAfter, engine.color);

      const { dbBefore, dbAfter } = engine.getDbValues();
      const gainPct = engine.getCurrentGainPct();
      card.querySelector('.gain-pct').textContent = `${gainPct}%`;

      const delta = (dbBefore <= -79 || dbAfter <= -79) ? 0 : (dbBefore - dbAfter);
      card.querySelector('.delta-db').textContent = `${delta.toFixed(1)} dB`;
    }
  });

  app.animHandle = requestAnimationFrame(animate);
}

window.addEventListener('beforeunload', () => {
  if (app.animHandle) cancelAnimationFrame(app.animHandle);
  app.engines.forEach(e => e.cleanup());
  if (app.audioCtx) app.audioCtx.close();
});

document.addEventListener('DOMContentLoaded', init);
