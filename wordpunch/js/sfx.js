/* Word Punch — WebAudio sound effects (no audio files, works offline) and
   read-aloud, shared with Word Kick. */
import { planClips, pickVoice } from './voice.js';
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

/* Read-aloud for kids who are still learning to read. `what` is a list of
   pieces (a question's `say`) or a plain string. Recorded ElevenLabs clips
   play when every piece has one (see voice.js); otherwise the best voice
   installed on the device reads it, which works offline on most phones. */

const VOICE_DIR = new URL('../voice/', import.meta.url);
let manifest = null;
let manifestLoad = null;
let playing = null;          // { audio, stop } for the clip sequence in progress
let speakToken = 0;

function loadManifest() {
  if (manifestLoad) return manifestLoad;
  manifestLoad = fetch(new URL('manifest.json', VOICE_DIR))
    .then(r => (r.ok ? r.json() : {}))
    .then(m => { manifest = m && typeof m === 'object' ? m : {}; })
    .catch(() => { manifest = {}; });
  return manifestLoad;
}
if (typeof window !== 'undefined') loadManifest();

let bestVoice = null;
function voice() {
  try {
    if (!bestVoice) bestVoice = pickVoice(window.speechSynthesis.getVoices());
  } catch { /* ignore */ }
  return bestVoice;
}
try { window.speechSynthesis?.addEventListener?.('voiceschanged', () => { bestVoice = null; }); } catch { /* ignore */ }

function deviceSpeak(text, rate) {
  try {
    if (!('speechSynthesis' in window)) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/___/g, 'blank'));
    u.rate = rate;
    u.lang = 'en-US';
    const v = voice();
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}

/* One audio element for every clip. iPhones and iPads only let a page play
   sound that starts from a tap, and the question audio starts a moment after
   the tap, so the element is "unlocked" with a silent sound on the first tap
   anywhere. After that it can play whenever. */
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
let shared = null;
function sharedAudio() {
  if (!shared && typeof Audio !== 'undefined') shared = new Audio();
  return shared;
}
if (typeof window !== 'undefined') {
  const unlock = () => {
    const a = sharedAudio();
    if (a && !playing) { a.src = SILENT; a.play().then(() => a.pause()).catch(() => {}); }
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('touchend', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('touchend', unlock, true);
}

/* Play clip files one after another with a short gap. Resolves false if a
   clip can't play (blocked autoplay, missing file, offline and not cached). */
function playClips(files, token) {
  return new Promise(resolve => {
    let i = 0;
    const audio = sharedAudio();
    playing = { audio };
    const next = () => {
      if (token !== speakToken) return resolve(true);
      if (i >= files.length) { playing = null; return resolve(true); }
      audio.src = new URL(files[i++], VOICE_DIR).href;
      audio.play().catch(() => { playing = null; resolve(false); });
    };
    audio.onended = () => setTimeout(next, 180);
    audio.onerror = () => { playing = null; resolve(false); };
    next();
  });
}

export function speak(what, { rate = 0.92 } = {}) {
  const parts = Array.isArray(what) ? what : [String(what)];
  const text = parts.join(' ');
  const token = ++speakToken;
  stopAudio();
  const go = () => {
    if (token !== speakToken) return;
    const files = planClips(parts, manifest);
    if (!files) return deviceSpeak(text, rate);
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    playClips(files, token).then(ok => { if (!ok && token === speakToken) deviceSpeak(text, rate); });
  };
  if (manifest) go(); else loadManifest().then(go);
  return true;
}

function stopAudio() {
  if (!playing) return;
  try { playing.audio.pause(); } catch { /* ignore */ }
  playing = null;
}

export function stopSpeaking() {
  speakToken++;
  stopAudio();
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}
export const canSpeak = () => typeof window !== 'undefined' && ('speechSynthesis' in window || typeof Audio !== 'undefined');
