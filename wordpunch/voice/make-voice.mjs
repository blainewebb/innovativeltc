#!/usr/bin/env node
/* Records the read-aloud clips for Word Punch and Word Kick with ElevenLabs.

   Run from the repo root:
     node wordpunch/voice/make-voice.mjs --dry-run   # count clips and characters, no API calls
     ELEVENLABS_API_KEY=... node wordpunch/voice/make-voice.mjs

   It only records what's missing from manifest.json, and saves the manifest
   after every clip, so it can be stopped and re-run safely. Clips for lines
   the games no longer say are removed with --prune.

   Options (environment variables):
     ELEVENLABS_API_KEY  required unless --dry-run
     VOICE_ID            default: Emma - Bright Kids Educator
     MODEL_ID            default: eleven_multilingual_v2
     OUTPUT_FORMAT       default: mp3_22050_32 (small files, clear speech)
   Flags: --dry-run, --prune, --limit N (record at most N clips this run) */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { allSpeechLines } from '../js/engine.js';
import { clipText, clipName } from '../js/voice.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(DIR, 'manifest.json');
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const PRUNE = args.includes('--prune');
const LIMIT = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;

const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.VOICE_ID || 'oClOrzqamOXmtcB8iqTj';
const MODEL_ID = process.env.MODEL_ID || 'eleven_multilingual_v2';
const FORMAT = process.env.OUTPUT_FORMAT || 'mp3_22050_32';

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const save = () => writeFileSync(MANIFEST, JSON.stringify(sortKeys(manifest), null, 1) + '\n');
const sortKeys = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

const lines = [...new Set(allSpeechLines().map(clipText))];
const wanted = new Set(lines);
const missing = lines.filter(t => !manifest[t] || !existsSync(join(DIR, manifest[t])));
const chars = missing.reduce((n, t) => n + t.length, 0);
console.log(`${lines.length} lines in the games, ${missing.length} still to record (${chars} characters).`);

if (PRUNE) {
  let gone = 0;
  for (const [text, file] of Object.entries(manifest)) {
    if (wanted.has(text)) continue;
    delete manifest[text];
    if (!Object.values(manifest).includes(file) && existsSync(join(DIR, file))) unlinkSync(join(DIR, file));
    gone++;
  }
  save();
  console.log(`Pruned ${gone} clips the games no longer use.`);
}

if (DRY || !missing.length) process.exit(0);
if (!KEY) {
  console.error('Set ELEVENLABS_API_KEY first (or use --dry-run).');
  process.exit(1);
}

/* File names come from a hash of the text. In the rare case two lines hash
   the same, the later one gets a suffix. */
const taken = new Map(Object.entries(manifest).map(([t, f]) => [f, t]));
function fileFor(text) {
  let name = clipName(text);
  for (let i = 1; taken.has(name) && taken.get(name) !== text; i++) name = clipName(text).replace('.mp3', `-${i}.mp3`);
  taken.set(name, text);
  return name;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function record(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=${FORMAT}`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const body = await res.text().catch(() => '');
    // Too many requests or a server hiccup: wait and try again, a few times.
    if ((res.status === 429 || res.status >= 500) && attempt < 5) { await sleep(1500 * 2 ** attempt); continue; }
    throw new Error(`ElevenLabs said ${res.status} for "${text}": ${body.slice(0, 300)}`);
  }
}

const todo = missing.slice(0, LIMIT);
let done = 0;
const queue = todo.slice();
async function worker() {
  while (queue.length) {
    const text = queue.shift();
    const file = fileFor(text);
    const audio = await record(text);
    writeFileSync(join(DIR, file), audio);
    manifest[text] = file;
    save();
    done++;
    if (done % 25 === 0 || done === todo.length) console.log(`  ${done}/${todo.length}`);
  }
}
try {
  await Promise.all([worker(), worker(), worker()]);
  console.log(`Recorded ${done} clips.`);
} catch (e) {
  console.error(e.message);
  console.error(`Stopped after ${done} clips. Saved progress; re-run to continue.`);
  process.exit(1);
}
