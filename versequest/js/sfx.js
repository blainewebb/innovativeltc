/* Verse Quest — WebAudio sound effects and read-aloud. No audio files, works
   offline. */
let ctx = null;
let enabled = true;

export function setEnabled(v) { enabled = !!v; }

function audio() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', gain = 0.06, delay = 0, slideTo = null) {
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

export const sfx = {
  tap:    () => tone(660, 0.04, 'triangle', 0.03),
  right:  () => { tone(784, 0.09, 'triangle', 0.06); tone(1047, 0.14, 'triangle', 0.06, 0.08); },
  wrong:  () => tone(220, 0.18, 'sawtooth', 0.04, 0, 160),
  step:   () => [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06, i * 0.1)),
  big:    () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.26, 'triangle', 0.06, i * 0.12)),
  soft:   () => [392, 330].forEach((f, i) => tone(f, 0.22, 'sine', 0.06, i * 0.16)),
};

/* Read-aloud uses the device's own voice, so it works offline on most phones
   and tablets. */
export function speak(text, { rate = 0.9 } = {}) {
  try {
    if (!('speechSynthesis' in window)) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\bLORD\b/g, 'Lord'));
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
