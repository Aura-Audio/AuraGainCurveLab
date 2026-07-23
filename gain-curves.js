/**
 * 20 Unique Gain Curve Configurations
 * Each engine gets: id, name, tag, color, and a curve function(phase) -> gain[0.01..1.0]
 */

export const ENGINE_CONFIGS = [
  {
    id: 1, name: 'Linear Descent', tag: '100% → 1% linear',
    color: '#4fd3c4', curve: p => 1 - p * 0.99
  },
  {
    id: 2, name: 'Exponential Decay', tag: 'Natural decay curve',
    color: '#ff8a3d', curve: p => Math.pow(0.01, p)
  },
  {
    id: 3, name: 'Logarithmic', tag: '1 / (1 + 99p)',
    color: '#7ee787', curve: p => 1 / (1 + p * 99)
  },
  {
    id: 4, name: 'Sine Tremolo', tag: 'Oscillating gain',
    color: '#ff5c5c', curve: p => 0.505 + 0.495 * Math.cos(p * Math.PI * 2)
  },
  {
    id: 5, name: 'Square Gate', tag: 'Hard on/off',
    color: '#c084fc', curve: p => p < 0.5 ? 1 : 0.01
  },
  {
    id: 6, name: 'Triangle Wave', tag: 'Up-down linear',
    color: '#fbbf24', curve: p => p < 0.5 ? 1 - p * 1.98 : 0.01 + (p - 0.5) * 1.98
  },
  {
    id: 7, name: 'Sawtooth Up', tag: '1% → 100%',
    color: '#60a5fa', curve: p => 0.01 + p * 0.99
  },
  {
    id: 8, name: 'Sawtooth Down', tag: 'Snap at 90%',
    color: '#f472b6', curve: p => p < 0.9 ? 1 : 0.01
  },
  {
    id: 9, name: 'Pulse 10%', tag: 'Short burst',
    color: '#a3e635', curve: p => p < 0.1 ? 1 : 0.01
  },
  {
    id: 10, name: 'Smoothstep', tag: 'Cubic ease',
    color: '#22d3ee', curve: p => 1 - 0.99 * (p * p * (3 - 2 * p))
  },
  {
    id: 11, name: 'Quintic Ease', tag: '5th-order smooth',
    color: '#e879f9', curve: p => 1 - 0.99 * (p * p * p * (p * (p * 6 - 15) + 10))
  },
  {
    id: 12, name: 'Bounce', tag: 'Underdamped spring',
    color: '#fb923c', curve: p => Math.max(0.01, Math.abs(Math.exp(-p * 4) * Math.cos(p * Math.PI * 6)))
  },
  {
    id: 13, name: 'Power 4', tag: 'Slow start, fast end',
    color: '#818cf8', curve: p => 1 - 0.99 * Math.pow(p, 4)
  },
  {
    id: 14, name: 'Power ¼', tag: 'Fast start, slow end',
    color: '#34d399', curve: p => 1 - 0.99 * Math.pow(p, 0.25)
  },
  {
    id: 15, name: 'Stepped 5', tag: '5 discrete levels',
    color: '#f87171', curve: p => 1 - Math.floor(p * 5) / 5 * 0.99
  },
  {
    id: 16, name: 'Hold & Decay', tag: 'Hold then drop',
    color: '#a78bfa', curve: p => p < 0.4 ? 1 : 1 - ((p - 0.4) / 0.6) * 0.99
  },
  {
    id: 17, name: 'Attack-Sustain', tag: 'Fade in, hold, fade out',
    color: '#2dd4bf', curve: p => {
      if (p < 0.2) return 0.01 + (p / 0.2) * 0.99;
      if (p > 0.8) return 1 - ((p - 0.8) / 0.2) * 0.99;
      return 1;
    }
  },
  {
    id: 18, name: 'Stutter 4×', tag: 'Rapid on/off',
    color: '#facc15', curve: p => (Math.floor(p * 4) % 2 === 0) ? 1 : 0.01
  },
  {
    id: 19, name: 'Swell', tag: '1% → 100% → 1%',
    color: '#67e8f9', curve: p => 0.01 + 0.99 * Math.sin(p * Math.PI)
  },
  {
    id: 20, name: 'Chaos LFO', tag: 'Multi-frequency interference',
    color: '#fda4af', curve: p => {
      const v = 0.5 + 0.49 * Math.sin(p * 13) * Math.cos(p * 7);
      return Math.max(0.01, Math.min(1, v + 0.01));
    }
  }
];
