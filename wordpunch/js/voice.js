/* Recorded voice clips, shared by Word Punch and Word Kick. Pure logic, no
   DOM, so it can be tested in Node.

   Every question is read as a list of short pieces ("say"), for example
   ["Which word is a noun?", "apple", "cat", "dog", "bird"]. Each piece can
   have a clip recorded once with ElevenLabs (voice/make-voice.mjs) and listed
   in voice/manifest.json as { "<text>": "<file>.mp3" }. A question plays from
   clips only when EVERY piece has one; otherwise the whole thing is read by
   the device voice, because switching voices mid-sentence sounds broken. */

/* The text a clip is recorded and looked up under. */
export const clipText = s => String(s).replace(/\s+/g, ' ').trim();

/* Short stable file name for a piece of text (FNV-1a, 32 bit). */
export function clipName(text) {
  let h = 0x811c9dc5;
  const t = clipText(text);
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16).padStart(8, '0')}.mp3`;
}

/* The clip files for these pieces, in order, or null if any is missing. */
export function planClips(parts, manifest) {
  if (!manifest || !Array.isArray(parts) || !parts.length) return null;
  const files = [];
  for (const p of parts) {
    const f = manifest[clipText(p)];
    if (!f) return null;
    files.push(f);
  }
  return files;
}

/* Pick the nicest installed voice for the device fallback. Phones ship
   several English voices and the default is often the flattest one. Enhanced,
   premium, natural and neural voices sound far better when they're there. */
const GOOD = /(premium|enhanced|natural|neural|siri|google us english|samantha|ava|allison|aria|jenny|zira)/i;
export function pickVoice(voices) {
  const en = (voices || []).filter(v => /^en(-|_|$)/i.test(v.lang || ''));
  if (!en.length) return null;
  const score = v => (GOOD.test(v.name) ? 4 : 0) + (/^en[-_]US/i.test(v.lang) ? 2 : 0) + (v.localService ? 1 : 0)
    - (/(compact|novelty|whisper|bells|bubbles|zarvox|trinoids|bad news|good news|organ|cellos)/i.test(v.name) ? 10 : 0);
  return en.slice().sort((a, b) => score(b) - score(a))[0];
}
