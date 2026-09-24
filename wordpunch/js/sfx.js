/* Word Punch — WebAudio sound effects. No audio files, works offline. */
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

export const sfx = {
  tap:     () => tone(600, 0.04, 'square', 0.03),
  bell:    () => { tone(1320, 0.5, 'sine', 0.12); tone(1320, 0.5, 'sine', 0.12, 0.28); tone(1760, 0.4, 'sine', 0.04); },
  jab:     () => { noise(0.08, 0.2, 0, 500); tone(160, 0.1, 'sine', 0.12, 0, 60); },
  upper:   () => { tone(300, 0.15, 'sawtooth', 0.06, 0, 900); noise(0.18, 0.3, 0.1, 400); tone(120, 0.2, 'sine', 0.15, 0.1, 40); },
  hit:     () => { noise(0.14, 0.25, 0, 250); tone(110, 0.2, 'sine', 0.14, 0, 50); },
  star:    () => { tone(880, 0.08, 'square', 0.05); tone(1175, 0.08, 'square', 0.05, 0.08); tone(1568, 0.16, 'square', 0.05, 0.16); },
  whoosh:  () => noise(0.18, 0.05, 0, 1800),
  down:    () => { tone(400, 0.6, 'triangle', 0.08, 0, 80); noise(0.3, 0.2, 0.45, 200); },
  count:   () => tone(440, 0.12, 'square', 0.05),
  cheer:   () => { noise(1.2, 0.05, 0, 1400); noise(1.0, 0.04, 0.2, 2200); },
  win:     () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'square', 0.06, i * 0.13)),
  lose:    () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.26, 'triangle', 0.07, i * 0.18)),
};

/* Read-aloud for kids who are still learning to read. Uses the device's own
   voice, so it works offline on most phones and tablets. */
export function speak(text, { rate = 0.92 } = {}) {
  try {
    if (!('speechSynthesis' in window)) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/___/g, 'blank'));
    u.rate = rate;
    u.lang = 'en-US';
    window.speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}
export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
