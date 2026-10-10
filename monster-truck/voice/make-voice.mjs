#!/usr/bin/env node
/* Records the read-aloud clips for Monster Truck Smash (voice: Emma - Bright Kids Educator, ElevenLabs).

   Every line comes from allLines() in ../content.js. Clips are saved here as <hash>.mp3 and listed in
   manifest.json (line text -> file). Only missing lines are recorded, so it is safe to re-run.

   Two ways to record, both from the repo root:

   1. With an API key, one request per line:
        ELEVENLABS_API_KEY=... node monster-truck/voice/make-voice.mjs

   2. In batches, from audio made elsewhere (for example the ElevenLabs app or connector):
        node monster-truck/voice/make-voice.mjs --batch 40 > batches.json
          Prints the missing lines in groups, each with the text to record: one line per paragraph.
          (Break tags between lines make the voice rush, so there are none.) Record each group as one
          take with eleven_multilingual_v2, get the word timings for the take (ElevenLabs Scribe,
          words.json), then:
        node monster-truck/voice/make-voice.mjs --split batches.json <group number> take.mp3 words.json
          Cuts the take between lines, at the quietest point between one line's last word and the
          next line's first word, and saves one clip per line. It saves nothing if the words in the
          timings don't match the lines.

   Other flags: --dry-run (count what's missing), --prune (delete clips for lines no longer used).
   Needs ffmpeg. */
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const DIR = dirname(fileURLToPath(import.meta.url));
const MTS = createRequire(import.meta.url)('../content.js');
const MANIFEST = join(DIR, 'manifest.json');
const args = process.argv.slice(2);
const flag = f => args.includes(f);
const opt = f => args.includes(f) ? args[args.indexOf(f) + 1] : null;

const VOICE_ID = process.env.VOICE_ID || 'oClOrzqamOXmtcB8iqTj';
const MODEL_ID = process.env.MODEL_ID || 'eleven_multilingual_v2';

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const save = () => writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');
const lines = MTS.allLines();
const missing = lines.filter(t => !manifest[t] || !existsSync(join(DIR, manifest[t])));
const fileFor = text => createHash('sha1').update(text).digest('hex').slice(0, 10) + '.mp3';

// Re-encode a piece of audio: mono, trimmed of silence at both ends, small enough to ship offline.
function encode(src, out, start, end) {
  const range = start == null ? [] : ['-ss', String(start), '-to', String(end)];
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...range, '-i', src,
    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse',
    '-ac', '1', '-ar', '24000', '-b:a', '40k', out]);
}
function duration(f) {
  return +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();
}

if (flag('--prune')) {
  const wanted = new Set(lines); let gone = 0;
  for (const [text, file] of Object.entries(manifest)) {
    if (wanted.has(text)) continue;
    delete manifest[text]; gone++;
    if (!Object.values(manifest).includes(file) && existsSync(join(DIR, file))) unlinkSync(join(DIR, file));
  }
  save(); console.error(`Pruned ${gone} clips no longer used.`);
}

if (opt('--batch')) {
  const size = +opt('--batch'), groups = [];
  for (let i = 0; i < missing.length; i += size) {
    const g = missing.slice(i, i + size);
    groups.push({ group: groups.length, lines: g, text: g.map(MTS.spokenText).join('\n\n') });
  }
  console.log(JSON.stringify(groups, null, 1));
  console.error(`${missing.length} lines missing, ${groups.length} groups.`);
  process.exit(0);
}

if (flag('--split')) {
  const [, file, groupNo, take, wordsFile] = args.slice(args.indexOf('--split'));
  const group = JSON.parse(readFileSync(file, 'utf8'))[+groupNo];
  const total = duration(take);
  let words = JSON.parse(readFileSync(wordsFile, 'utf8'));
  words = (words.words || words).filter(w => w.type === 'word');
  // Give each word of the take to its line, checking the words match what was meant to be said.
  const norm = t => t.toLowerCase().replace(/[^a-z0-9']/g, '');
  const spans = [];
  let k = 0;
  for (const line of group.lines) {
    const toks = MTS.spokenText(line).split(/\s+/).filter(t => norm(t));
    const ws = words.slice(k, k + toks.length);
    const bad = toks.findIndex((t, i) => !ws[i] || norm(ws[i].text) !== norm(t));
    if (bad >= 0) {
      console.error(`Group ${groupNo}: expected "${toks[bad]}" in "${line}", the timings have "${ws[bad] ? ws[bad].text : 'nothing'}". Nothing saved.`);
      process.exit(2);
    }
    spans.push([ws[0].start, ws[ws.length - 1].end]);
    k += toks.length;
  }
  if (k !== words.length) { console.error(`Group ${groupNo}: ${words.length - k} extra words in the timings. Nothing saved.`); process.exit(2); }
  // Quiet stretches of the take (silencedetect reports on stderr).
  const out = execFileSync('sh', ['-c', 'ffmpeg -hide_banner -i "$1" -af silencedetect=noise=-42dB:d=0.08 -f null - 2>&1', 'sh', take]).toString();
  const qs = [...out.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map(m => [+m[1], +m[2]]);
  const cutBetween = (a, b) => {
    let best = null;
    for (const [s0, s1] of qs) {
      const lo = Math.max(s0, a - 0.15), hi = Math.min(s1, b + 0.15);
      if (hi > lo && (!best || hi - lo > best[1] - best[0])) best = [lo, hi];
    }
    return best ? (best[0] + best[1]) / 2 : (a + b) / 2;
  };
  const cuts = [0];
  for (let i = 0; i + 1 < spans.length; i++) cuts.push(cutBetween(spans[i][1], spans[i + 1][0]));
  cuts.push(total);
  group.lines.forEach((text, i) => {
    const name = fileFor(text);
    encode(take, join(DIR, name), cuts[i], cuts[i + 1]);
    manifest[text] = name;
  });
  save();
  console.error(`Group ${groupNo}: saved ${group.lines.length} clips.`);
  group.lines.forEach((t, i) => console.error(`  ${duration(join(DIR, fileFor(t))).toFixed(2)}s  ${t}`));
  process.exit(0);
}

const chars = missing.reduce((n, t) => n + MTS.spokenText(t).length, 0);
console.error(`${lines.length} lines in the game, ${missing.length} still to record (${chars} characters).`);
if (flag('--dry-run') || !missing.length) process.exit(0);

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('Set ELEVENLABS_API_KEY, or record in batches with --batch / --split.'); process.exit(1); }
const tmp = mkdtempSync(join(tmpdir(), 'mts-voice-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (const text of missing) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: MTS.spokenText(text), model_id: MODEL_ID })
    });
    if (res.ok) {
      const raw = join(tmp, 'raw.mp3');
      writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
      const name = fileFor(text);
      encode(raw, join(DIR, name));
      manifest[text] = name; save();
      console.error(`ok  ${text}`);
      break;
    }
    if (attempt >= 4 || (res.status < 500 && res.status !== 429)) { console.error(`failed (${res.status}): ${text}\n${await res.text()}`); process.exit(1); }
    await sleep(2000 * attempt);
  }
}
rmSync(tmp, { recursive: true, force: true });
