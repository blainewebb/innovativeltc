/* Word Kick — static content: teams, cups and kits. The English itself (word
   lists, sentences, spelling) is Word Punch's, imported from ../wordpunch so
   there is one copy to fix. Pure data. No DOM, no storage. */

/* Shown on the title screen. Bump it alongside CACHE in sw.js. */
export const VERSION = '2026-09-24.1';

export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8];

/* Word Kick plays one grade easier than Word Punch: a 3rd grader gets the
   2nd grade words, sentences and spelling. 1st grade has nothing below it, so
   it stays on 1st grade content and gets 3 choices instead of 4 and a
   longer clock instead (see engine.js). */
export const contentGrade = grade => Math.max(1, grade - 1);

/* --------------------------------------------------------------- teams --
   Eight rival teams, easiest first. `focus` is the part of speech their
   questions lean on (ignored when the grade doesn't teach it yet) and `spell`
   is the share of spelling questions. Their difficulty comes from their place
   on the ladder, not from here. `kit` is the outfield shirt; the keeper
   wears `gk`, like a real keeper in a different color. */
export const TEAMS = [
  { id: 'nouncity', name: 'Noun City FC', short: 'Noun City', nick: 'The Namers',
    keeper: 'Big Ned', quote: 'A person, a place, a thing... and a SAVE!',
    focus: 'n', spell: 0.4,
    kit: { shirt: '#7c3aed', trim: '#facc15', shorts: '#4c1d95', num: '#facc15' }, gk: '#22c55e', skin: '#f2c894', hair: '#7a4a24' },
  { id: 'rovers', name: 'Spelling Rovers', short: 'Rovers', nick: 'The Letter Pack',
    keeper: 'Silent Kay', quote: 'The K in "knee" is silent. So am I, until I stop your shot.',
    focus: null, spell: 0.65,
    kit: { shirt: '#0f766e', trim: '#ffffff', shorts: '#ffffff', num: '#ffffff' }, gk: '#f97316', skin: '#e0ac7e', hair: '#1f1f1f' },
  { id: 'athletic', name: 'Adjective Athletic', short: 'Athletic', nick: 'The Fancy Feet', champion: 'local',
    keeper: 'Fancy Fran', quote: 'My saves are spectacular, marvelous, and totally amazing!',
    focus: 'a', spell: 0.35,
    kit: { shirt: '#db2777', trim: '#ffffff', shorts: '#831843', num: '#ffffff' }, gk: '#facc15', skin: '#8d5a3b', hair: '#111827' },
  { id: 'palace', name: 'Pronoun Palace', short: 'Palace', nick: 'The Stand-Ins',
    keeper: 'Mr. Himself', quote: 'Me? Myself? I will save it MYSELF!',
    focus: 'pr', spell: 0.4,
    kit: { shirt: '#1e3a8a', trim: '#ef4444', shorts: '#ef4444', num: '#ffffff' }, gk: '#a3e635', skin: '#f5d0b0', hair: '#b45309' },
  { id: 'united', name: 'Adverb United', short: 'United', nick: 'The Quicklys',
    keeper: 'Quickly Quinn', quote: 'I dive quickly, catch cleanly, and win easily.',
    focus: 'av', spell: 0.35,
    kit: { shirt: '#b91c1c', trim: '#111827', shorts: '#111827', num: '#ffffff' }, gk: '#38bdf8', skin: '#c68a5a', hair: '#3a2415' },
  { id: 'wanderers', name: 'Verbton Wanderers', short: 'Wanderers', nick: 'The Movers', champion: 'continental',
    keeper: 'Diving Dex', quote: 'I leap. I stretch. I SNATCH it out of the air!',
    focus: 'v', spell: 0.35,
    kit: { shirt: '#f59e0b', trim: '#111827', shorts: '#111827', num: '#111827' }, gk: '#6366f1', skin: '#e8b98f', hair: '#111827' },
  { id: 'dynamo', name: 'Dictionary Dynamo', short: 'Dynamo', nick: 'The Definers',
    keeper: 'Dr. Definition', quote: 'I know every word. And every corner of this goal.',
    focus: null, spell: 0.6,
    kit: { shirt: '#0e7490', trim: '#fde047', shorts: '#164e63', num: '#fde047' }, gk: '#ec4899', skin: '#6b4226', hair: '#e5e7eb' },
  { id: 'galaxy', name: 'Grammar Galaxy FC', short: 'Galaxy', nick: 'The Great Wall', champion: 'golden',
    keeper: 'The Great Wall', quote: 'Every word. Every letter. Every shot. Stopped.',
    focus: null, spell: 0.5,
    kit: { shirt: '#111827', trim: '#facc15', shorts: '#111827', num: '#facc15' }, gk: '#f8fafc', skin: '#f0c7a0', hair: '#a16207' },
];

export const CUPS = [
  { id: 'local', name: 'Local Cup', trophy: 'Local Cup', teams: [0, 1, 2] },
  { id: 'continental', name: 'Continental Cup', trophy: 'Continental Cup', teams: [3, 4, 5] },
  { id: 'golden', name: 'Golden Cup', trophy: 'Golden Cup', teams: [6, 7] },
];

/* ---------------------------------------------------------------- kits --
   The player's shirt, in national team colors. Colors only: no crests, no
   federation logos. `pattern` is solid, stripes (vertical), hoops, checks or
   sash. `num` is the shirt number color, picked to read on the shirt. */
export const KITS = [
  { id: 'argentina',   name: 'Argentina',   shirt: '#75aadb', alt: '#ffffff', pattern: 'stripes', shorts: '#111827', socks: '#ffffff', num: '#111827' },
  { id: 'brazil',      name: 'Brazil',      shirt: '#fedd00', alt: '#009c3b', pattern: 'solid',   shorts: '#1d4ed8', socks: '#ffffff', num: '#009c3b' },
  { id: 'usa',         name: 'USA',         shirt: '#ffffff', alt: '#1e3a8a', pattern: 'solid',   shorts: '#1e3a8a', socks: '#ffffff', num: '#1e3a8a' },
  { id: 'mexico',      name: 'Mexico',      shirt: '#006847', alt: '#ce1126', pattern: 'solid',   shorts: '#ffffff', socks: '#ce1126', num: '#ffffff' },
  { id: 'england',     name: 'England',     shirt: '#ffffff', alt: '#ce1126', pattern: 'solid',   shorts: '#1e3a8a', socks: '#ffffff', num: '#1e3a8a' },
  { id: 'france',      name: 'France',      shirt: '#1e3a8a', alt: '#ef4444', pattern: 'solid',   shorts: '#ffffff', socks: '#ef4444', num: '#ffffff' },
  { id: 'germany',     name: 'Germany',     shirt: '#ffffff', alt: '#111827', pattern: 'solid',   shorts: '#111827', socks: '#ffffff', num: '#111827' },
  { id: 'spain',       name: 'Spain',       shirt: '#c8102e', alt: '#facc15', pattern: 'solid',   shorts: '#1e3a8a', socks: '#1e3a8a', num: '#facc15' },
  { id: 'italy',       name: 'Italy',       shirt: '#1f6fd1', alt: '#ffffff', pattern: 'solid',   shorts: '#ffffff', socks: '#1f6fd1', num: '#ffffff' },
  { id: 'portugal',    name: 'Portugal',    shirt: '#9f1239', alt: '#15803d', pattern: 'solid',   shorts: '#15803d', socks: '#9f1239', num: '#facc15' },
  { id: 'netherlands', name: 'Netherlands', shirt: '#f97316', alt: '#111827', pattern: 'solid',   shorts: '#f97316', socks: '#f97316', num: '#111827' },
  { id: 'croatia',     name: 'Croatia',     shirt: '#dc2626', alt: '#ffffff', pattern: 'checks',  shorts: '#ffffff', socks: '#1e3a8a', num: '#1e3a8a' },
  { id: 'japan',       name: 'Japan',       shirt: '#1e3a8a', alt: '#ffffff', pattern: 'solid',   shorts: '#1e3a8a', socks: '#1e3a8a', num: '#ffffff' },
  { id: 'canada',      name: 'Canada',      shirt: '#d52b1e', alt: '#ffffff', pattern: 'solid',   shorts: '#d52b1e', socks: '#d52b1e', num: '#ffffff' },
  { id: 'nigeria',     name: 'Nigeria',     shirt: '#008751', alt: '#ffffff', pattern: 'sash',    shorts: '#008751', socks: '#008751', num: '#ffffff' },
  { id: 'scotland',    name: 'Scotland',    shirt: '#1e2a5a', alt: '#ffffff', pattern: 'solid',   shorts: '#ffffff', socks: '#1e2a5a', num: '#ffffff' },
];

export const kitById = id => KITS.find(k => k.id === id) || KITS[0];

/* Kick names shown under the scoreboard, one per question format. */
export const KICK_NAMES = {
  pick_pos: 'Word Strike',
  name_pos: 'Grammar Curler',
  tap_pos: 'Sentence Volley',
  spell_pick: 'Spelling Blast',
  spell_fix: 'Red-Pen Rocket',
};
