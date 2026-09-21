/* Runebreaker — tiny WebAudio blips. No files to download, works offline. */
let ctx = null;
let enabled = true;

export function setEnabled(v) { enabled = v; }
export function isEnabled() { return enabled; }

function tone(freq, dur, type = 'square', gain = 0.06, delay = 0) {
  if (!enabled) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch { /* audio blocked, no problem */ }
}

export const sfx = {
  tap:    () => tone(520, 0.05, 'square', 0.03),
  hit:    () => { tone(300, 0.09, 'sawtooth', 0.07); tone(150, 0.16, 'square', 0.05, 0.04); },
  crit:   () => { tone(660, 0.07, 'square', 0.07); tone(880, 0.07, 'square', 0.07, 0.07); tone(1320, 0.14, 'square', 0.06, 0.14); },
  wrong:  () => { tone(180, 0.18, 'sawtooth', 0.06); tone(120, 0.24, 'sawtooth', 0.05, 0.1); },
  hurt:   () => tone(110, 0.22, 'sawtooth', 0.07),
  win:    () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.06, i * 0.09)); },
  lose:   () => { [440, 370, 294, 220].forEach((f, i) => tone(f, 0.22, 'triangle', 0.06, i * 0.13)); },
  reward: () => { [784, 988].forEach((f, i) => tone(f, 0.14, 'square', 0.05, i * 0.08)); },
  shatter:() => { [1200, 900, 600].forEach((f, i) => tone(f, 0.08, 'square', 0.06, i * 0.05)); },
};
