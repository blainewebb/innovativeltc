/* Runebreaker backup/restore tests. Run: node test/storage.test.mjs
   storage.js only touches localStorage inside load/save, so the export,
   import and normalising helpers are testable in plain Node. */
import assert from 'node:assert/strict';
import { newProfile, normalizeProfile, exportPayload, exportFilename,
         parseImport, asCopy, hydrate, EXPORT_FORMAT } from '../js/storage.js';
import { blankMastery, recordAttempt, skillScore, shakyFacts } from '../js/engine.js';
import { SKILLS } from '../js/data.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e.message}`); process.exitCode = 1; }
};

function heroWithHistory(name = 'Leo') {
  const p = newProfile(name, '\u{1F409}');
  for (let i = 0; i < 20; i++) recordAttempt(p.mastery, { skill: 'add_small', fact: '7+8', correct: true, ms: 1600 });
  for (let i = 0; i < 9; i++) recordAttempt(p.mastery, { skill: 'mult_hard', fact: '7*8', correct: false, ms: 11000 });
  p.records = { ...p.records, deepest: 14, runs: 6, bossesFelled: 2, wins: 1, bestEndless: 3, floorsBeaten: 47 };
  p.days = [{ date: '2026-09-20', ms: 900000, correct: 40, wrong: 7 }];
  return p;
}

test('a hero survives a full export and import round trip', () => {
  const before = heroWithHistory();
  const text = JSON.stringify(exportPayload([before]));
  const [after] = parseImport(text);

  assert.equal(after.id, before.id);
  assert.equal(after.name, before.name);
  assert.equal(after.avatar, before.avatar);
  assert.deepEqual(after.records, before.records);
  assert.deepEqual(after.days, before.days);
  // The learning record is the whole point of the backup.
  assert.deepEqual(after.mastery.facts, before.mastery.facts);
  assert.equal(skillScore(after.mastery.skills.add_small, 'add_small'),
               skillScore(before.mastery.skills.add_small, 'add_small'));
  assert.deepEqual(shakyFacts(after.mastery).map(f => f.key), shakyFacts(before.mastery).map(f => f.key));
});

test('several heroes export and come back together', () => {
  const a = heroWithHistory('Leo'), b = heroWithHistory('Sam');
  const heroes = parseImport(JSON.stringify(exportPayload([a, b])));
  assert.equal(heroes.length, 2);
  assert.deepEqual(heroes.map(h => h.name), ['Leo', 'Sam']);
});

test('the filename says who and when', () => {
  assert.match(exportFilename([heroWithHistory('Leo')]), /^runebreaker-leo-\d{4}-\d{2}-\d{2}\.json$/);
  assert.match(exportFilename([heroWithHistory('a'), heroWithHistory('b')]), /^runebreaker-all-heroes-/);
});

test('junk is refused with a message a parent can act on', () => {
  const cases = [
    ['not json at all', /does not look like/],
    ['{"app":"something-else"}', /not a Runebreaker backup/],
    ['{"app":"runebreaker","heroes":[]}', /no heroes/],
    [`{"app":"runebreaker","format":${EXPORT_FORMAT + 1},"heroes":[{"name":"x"}]}`, /newer version/],
  ];
  for (const [text, expected] of cases) {
    assert.throws(() => parseImport(text), expected, `input: ${text}`);
    try { parseImport(text); } catch (e) {
      assert.ok(!/undefined|\[object|SyntaxError/.test(e.message), `unfriendly message: ${e.message}`);
    }
  }
});

test('a backup from an older version still loads, with new skills filled in', () => {
  // An export written before a skill existed must not leave holes that crash
  // the report card later.
  const old = heroWithHistory();
  delete old.mastery.skills.div_hard;
  delete old.records.wins;
  delete old.meta;
  const [after] = parseImport(JSON.stringify(exportPayload([old])));
  for (const s of SKILLS) assert.ok(after.mastery.skills[s.id], `missing skill ${s.id}`);
  assert.equal(after.records.wins, 0);
  assert.deepEqual(after.meta.startRunes, []);
});

test('normalising rejects nonsense and repairs the salvageable', () => {
  assert.equal(normalizeProfile(null), null);
  assert.equal(normalizeProfile('nope'), null);
  const fixed = normalizeProfile({ name: 'X', mastery: { skills: { add_small: { attempts: 'lots' } } }, days: [null, { date: '2026-01-01' }] });
  assert.equal(fixed.mastery.skills.add_small.attempts, 0, 'a non-number must not poison the maths');
  assert.equal(fixed.days.length, 1);
  assert.ok(Number.isFinite(skillScore(fixed.mastery.skills.add_small, 'add_small')));
});

test('a very long name from a hand-edited file is trimmed', () => {
  const p = normalizeProfile({ name: 'x'.repeat(200) });
  assert.ok(p.name.length <= 12);
});

test('keeping both gives the copy its own id and a distinct name', () => {
  const a = heroWithHistory('Leo');
  const b = asCopy(a);
  assert.notEqual(b.id, a.id);
  assert.notEqual(b.name, a.name);
  assert.deepEqual(b.mastery.facts, a.mastery.facts, 'the copy keeps the learning record');
});

test('importing does not mutate the exported hero', () => {
  const before = heroWithHistory();
  const snapshot = JSON.stringify(before);
  parseImport(JSON.stringify(exportPayload([before])));
  assert.equal(JSON.stringify(before), snapshot);
});

/* ------------------------------------------- surviving an update -- */
/* The promise being kept here: shipping a new version never costs a family
   their heroes. Every one of these is a save written by an older build. */

test('a hero saved before grades and drill settings existed still loads', () => {
  const ancient = {
    profiles: [{
      id: 'p1', name: 'Hudson', avatar: '\u{1F409}', created: 1700000000000,
      mastery: { skills: { add_small: { attempts: 40, correct: 38, ema: 0.95, totalMs: 60000 } }, facts: { '7+8': { attempts: 9, correct: 7, ema: 0.8, totalMs: 18000 } } },
      records: { deepest: 8, runs: 3, bossesFelled: 1 },
      days: [{ date: '2026-09-20', ms: 600000, correct: 30, wrong: 5 }],
    }],
    activeId: 'p1',
    settings: { sound: true },
  };
  const data = hydrate(ancient);
  assert.equal(data.profiles.length, 1);
  const h = data.profiles[0];
  assert.equal(h.name, 'Hudson');
  assert.equal(h.records.deepest, 8, 'their record must survive');
  assert.equal(h.mastery.facts['7+8'].attempts, 9, 'their learning record must survive');
  assert.equal(data.activeId, 'p1');
  // Fields added by later releases are filled in rather than left undefined.
  assert.equal(h.grade, 0);
  assert.equal(h.prefs.drills, true);
  assert.equal(h.records.wins, 0);
  assert.equal(h.records.bestEndless, 0);
  for (const s of SKILLS) assert.ok(h.mastery.skills[s.id], `missing skill ${s.id}`);
});

test('hydrating never drops or empties a hero', () => {
  const before = newProfile('Leo', '\u{1F409}', 3);
  for (let i = 0; i < 12; i++) recordAttempt(before.mastery, { skill: 'mult_hard', fact: '7*8', correct: false, ms: 9000 });
  const data = hydrate({ profiles: [before], activeId: before.id, settings: {} });
  assert.equal(data.profiles.length, 1);
  assert.deepEqual(data.profiles[0].mastery.facts, before.mastery.facts);
  assert.equal(data.profiles[0].grade, 3);
});

test('a pointer to a hero who is gone does not leave an empty hub', () => {
  const data = hydrate({ profiles: [newProfile('A', 'x', 1)], activeId: 'someone-deleted' });
  assert.equal(data.activeId, null, 'should fall back to the picker, not a blank hub');
});

test('a corrupt or empty store returns something usable rather than throwing', () => {
  for (const input of [null, undefined, 'nonsense', 42, {}, { profiles: 'not an array' }]) {
    const data = hydrate(input);
    assert.deepEqual(data.profiles, []);
    assert.equal(data.activeId, null);
    assert.equal(data.settings.sound, true);
  }
});

test('sound preference survives, and an unknown setting does not wipe the rest', () => {
  assert.equal(hydrate({ settings: { sound: false } }).settings.sound, false);
  assert.equal(hydrate({ settings: { somethingNew: 1 } }).settings.sound, true);
});

test('a hero with a garbled record is repaired, not discarded', () => {
  const data = hydrate({ profiles: [
    { id: 'p1', name: 'Keep', mastery: { skills: { add_small: { attempts: 'lots' } } } },
    null,
    'nonsense',
  ] });
  assert.deepEqual(data.profiles.map(p => p.name), ['Keep'], 'the real hero is kept');
  assert.equal(data.profiles[0].mastery.skills.add_small.attempts, 0);
});

test('a hero from before earned avatars is credited, not reset to zero', () => {
  const old = {
    profiles: [{
      id: 'p1', name: 'Hudson', avatar: '\u{1F409}',
      mastery: { skills: {}, facts: {} },
      records: { deepest: 8, runs: 3, bossesFelled: 1 },
      days: [],
    }],
    activeId: 'p1',
  };
  const hero = hydrate(old).profiles[0];
  assert.equal(hero.records.floorsBeaten, 8,
    'their deepest floor is the most we can honestly infer, and beats showing zero');
});

test('a hero who really has beaten nothing keeps a zero', () => {
  const hero = hydrate({ profiles: [{ id: 'p', name: 'New', mastery: {}, records: { deepest: 0 } }] }).profiles[0];
  assert.equal(hero.records.floorsBeaten, 0);
});

test('an existing floor count is never overwritten by the fallback', () => {
  const hero = hydrate({ profiles: [{ id: 'p', name: 'X', mastery: {}, records: { deepest: 8, floorsBeaten: 40 } }] }).profiles[0];
  assert.equal(hero.records.floorsBeaten, 40);
});

console.log(`${passed} storage tests passed`);
