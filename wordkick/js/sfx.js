/* Word Kick — WebAudio sound effects. No audio files, works offline.
   Read-aloud is Word Punch's. */
export { speak, stopSpeaking, canSpeak } from '../../wordpunch/js/sfx.js';

let ctx = null;
let enabled = true;

export function setEnabled(v) { enabled = !!v; }

function audio() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'square', gain = 0.06, delay = 0, slideTo = null) {
  if (!enabled) return;
  try {
    const c = audio();
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch { /* audio blocked, carry on silently */ }
}

function noise(dur, gain = 0.08, delay = 0, freq = 900) {
  if (!enabled) return;
  try {
    const c = audio();
    const t0 = c.currentTime + delay;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g).connect(c.destination);
    src.start(t0);
  } catch { /* ignore */ }
}

/* A referee's whistle: a high tone with a fast warble. */
function whistle(dur, delay = 0) {
  if (!enabled) return;
  try {
    const c = audio();
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = 2600;
    lfo.frequency.value = 38;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(osc.frequency);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.02);
    g.gain.setValueAtTime(0.07, t0 + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0); lfo.start(t0);
    osc.stop(t0 + dur + 0.02); lfo.stop(t0 + dur + 0.02);
  } catch { /* ignore */ }
}

export const sfx = {
  tap:     () => tone(600, 0.04, 'square', 0.03),
  whistle: () => whistle(0.45),
  final:   () => { whistle(0.3); whistle(0.3, 0.4); whistle(0.8, 0.8); },
  kick:    () => { noise(0.06, 0.25, 0, 300); tone(140, 0.12, 'sine', 0.16, 0, 60); },
  net:     () => { noise(0.35, 0.06, 0, 2400); },
  goal:    () => { noise(1.4, 0.07, 0, 1200); noise(1.2, 0.05, 0.15, 2000); [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'square', 0.05, 0.1 + i * 0.1)); },
  save:    () => { noise(0.1, 0.25, 0, 500); tone(220, 0.15, 'sine', 0.12, 0, 90); },
  groan:   () => { noise(0.9, 0.05, 0, 500); tone(300, 0.6, 'triangle', 0.05, 0, 150); },
  post:    () => { tone(1800, 0.5, 'triangle', 0.08); tone(2400, 0.4, 'sine', 0.04); },
  star:    () => { tone(880, 0.08, 'square', 0.05); tone(1175, 0.08, 'square', 0.05, 0.08); tone(1568, 0.16, 'square', 0.05, 0.16); },
  cheer:   () => { noise(1.4, 0.06, 0, 1400); noise(1.2, 0.05, 0.2, 2200); },
  win:     () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'square', 0.06, i * 0.13)),
  lose:    () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.26, 'triangle', 0.07, i * 0.18)),
};
