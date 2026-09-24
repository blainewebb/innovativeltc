/* Word Punch — static content: fighters, circuits, and the English content
   for grades 1-8. Pure data. No DOM, no storage. */

/* Shown on the title screen so "is this the new version?" is something you
   read rather than guess. Bump it alongside CACHE in sw.js. */
export const VERSION = '2026-09-24.3';

/* ------------------------------------------------------ parts of speech --
   `short` is the one-line rule shown after a miss. Grade 1 gets the plain
   "shows an action" version of verb, since "state of being" means nothing to
   a six year old. */
export const POS = {
  n:  { label: 'Noun',      upper: 'NOUN',      rule: 'a noun names a person, place, thing, or idea' },
  v:  { label: 'Verb',      upper: 'VERB',      rule: 'a verb shows an action or a state of being' },
  a:  { label: 'Adjective', upper: 'ADJECTIVE', rule: 'an adjective describes a noun' },
  av: { label: 'Adverb',    upper: 'ADVERB',    rule: 'an adverb tells how, when, where, or how often' },
  pr: { label: 'Pronoun',   upper: 'PRONOUN',   rule: 'a pronoun takes the place of a noun' },
};
export const POS_ORDER = ['n', 'v', 'a', 'av', 'pr'];

/* Which parts of speech each grade is asked about. This follows the order the
   Common Core language standards introduce them (adjectives in 1st, adverbs in
   2nd, pronouns named in 3rd). It is a sensible default, not a claim about any
   particular school's curriculum. */
export function posForGrade(grade) {
  if (grade <= 1) return ['n', 'v', 'a'];
  if (grade === 2) return ['n', 'v', 'a', 'av'];
  return ['n', 'v', 'a', 'av', 'pr'];
}

/* The skills the coach's corner reports on. */
export const SKILLS = [
  { id: 'n',     label: 'Nouns' },
  { id: 'v',     label: 'Verbs' },
  { id: 'a',     label: 'Adjectives' },
  { id: 'av',    label: 'Adverbs' },
  { id: 'pr',    label: 'Pronouns' },
  { id: 'spell', label: 'Spelling' },
];

/* ------------------------------------------------------------- fighters --
   `spell` is the share of this fighter's questions that are spelling, the
   rest being parts of speech. `focus` is the part of speech they lean on.
   Stats (health, punch power, clock) come from the fighter's index, not from
   here, so the ladder gets harder in a straight line. */
export const FIGHTERS = [
  { id: 'larry', name: 'Lowercase Larry', from: 'Tinytown', record: '1-23',
    quote: "Go easy on me. I only know the small letters!",
    special: 'Wobbly Noun Jabs', focus: 'n', spell: 0.4,
    look: { skin: '#f2c894', hair: '#7a4a24', trunks: '#3b82f6', gloves: '#e11d48', acc: 'none', brow: 'worried' } },
  { id: 'vinnie', name: 'Vowel Vinnie', from: 'Vowelton', record: '8-10',
    quote: 'A, E, I, O, U... and sometimes YOU get knocked out!',
    special: 'Spelling Hooks', focus: null, spell: 0.65,
    look: { skin: '#e0ac7e', hair: '#1f1f1f', trunks: '#16a34a', gloves: '#f59e0b', acc: 'mustache', brow: 'flat' } },
  { id: 'capital', name: 'Captain Capital', from: 'Uppercase City', record: '15-4', champion: 'minor',
    quote: 'I always come FIRST in a sentence!',
    special: 'Noun Haymakers', focus: 'n', spell: 0.4,
    look: { skin: '#c68a5a', hair: '#3a2415', trunks: '#1d4ed8', gloves: '#dc2626', acc: 'cap', brow: 'angry' } },
  { id: 'steve', name: 'Silent Steve', from: 'Knight Falls', record: '18-5',
    quote: "You won't hear me coming. Just like the K in knock.",
    special: 'Sneaky Spelling', focus: null, spell: 0.6,
    look: { skin: '#f5d0b0', hair: '#b45309', trunks: '#475569', gloves: '#0ea5e9', acc: 'beanie', brow: 'flat' } },
  { id: 'adjectiva', name: 'Madame Adjectiva', from: 'Fancyville', record: '22-3',
    quote: 'I am fabulous, marvelous, and magnificent, darling!',
    special: 'Adjective Uppercuts', focus: 'a', spell: 0.35,
    look: { skin: '#8d5a3b', hair: '#7c3aed', trunks: '#db2777', gloves: '#f472b6', acc: 'bow', brow: 'angry' } },
  { id: 'verbini', name: 'The Great Verbini', from: 'Actionburg', record: '27-2', champion: 'major',
    quote: "I don't walk. I stride, I strut, I SPRINT!",
    special: 'Verb Combos', focus: 'v', spell: 0.35,
    look: { skin: '#e8b98f', hair: '#111827', trunks: '#7f1d1d', gloves: '#fbbf24', acc: 'tophat', brow: 'angry' } },
  { id: 'dictionary', name: 'Dr. Dictionary', from: 'Library Heights', record: '31-1',
    quote: "Look it up, kid. It's all in here.",
    special: 'Spelling Bees', focus: null, spell: 0.6,
    look: { skin: '#6b4226', hair: '#e5e7eb', trunks: '#0f766e', gloves: '#14b8a6', acc: 'glasses', brow: 'angry' } },
  { id: 'king', name: 'King Grammaticus', from: 'The Kingdom of Grammar', record: '40-0', champion: 'world',
    quote: 'Every word. Every letter. Perfect. Always.',
    special: 'Everything', focus: null, spell: 0.5,
    look: { skin: '#f0c7a0', hair: '#a16207', trunks: '#6d28d9', gloves: '#facc15', acc: 'crown', brow: 'angry' } },
];

export const CIRCUITS = [
  { id: 'minor', name: 'Minor Circuit', belt: 'Minor Circuit Belt', fighters: [0, 1, 2] },
  { id: 'major', name: 'Major Circuit', belt: 'Major Circuit Belt', fighters: [3, 4, 5] },
  { id: 'world', name: 'World Circuit', belt: 'World Championship Belt', fighters: [6, 7] },
];

/* ------------------------------------------------------------ word lists --
   Stand-alone words for "Which word is a NOUN?". A word with no sentence
   around it has to be one part of speech and nothing else, or the question
   has two right answers. So these lists deliberately leave out everyday words
   that are two things at once (run, play, jump, dance, fish, rain, sleep,
   light, fast, clean, cold...). Those turn up in the tagged sentences below
   instead, where the sentence decides. The tests fail if a word lands in two
   lists anywhere in the game. */
export const WORDS = {
  1: {
    n: ['apple', 'cat', 'dog', 'house', 'girl', 'boy', 'tree', 'bird', 'bed', 'car', 'frog', 'pig', 'horse', 'banana', 'teacher', 'baby', 'cake', 'chair'],
    v: ['eat', 'sit', 'go', 'see', 'sing', 'give', 'come', 'went', 'ran', 'ate', 'sat', 'jumped', 'played', 'kicked', 'laughed', 'cried', 'swam', 'said'],
    a: ['happy', 'big', 'sad', 'tall', 'hot', 'soft', 'funny', 'silly', 'tiny', 'fluffy', 'yummy', 'sleepy', 'new', 'old', 'short', 'hungry'],
  },
  2: {
    n: ['garden', 'kitten', 'pencil', 'rabbit', 'window', 'castle', 'dragon', 'pizza', 'rocket', 'sister', 'puppy', 'turtle', 'blanket', 'forest', 'farmer', 'cookie', 'monkey', 'river'],
    v: ['build', 'climb', 'carry', 'learn', 'grow', 'bring', 'choose', 'wrote', 'threw', 'caught', 'flew', 'drew', 'sang', 'chased', 'carried', 'splashed', 'wiggled', 'forget'],
    a: ['shiny', 'huge', 'gentle', 'grumpy', 'noisy', 'sticky', 'cozy', 'spooky', 'curious', 'sunny', 'windy', 'muddy', 'delicious', 'bright', 'sparkly', 'fuzzy'],
    av: ['quickly', 'slowly', 'loudly', 'quietly', 'softly', 'happily', 'sadly', 'carefully', 'gently', 'suddenly', 'bravely', 'neatly', 'never', 'always'],
  },
  3: {
    n: ['mountain', 'ocean', 'family', 'village', 'journey', 'museum', 'hospital', 'astronaut', 'volcano', 'neighbor', 'planet', 'dinosaur', 'blizzard', 'kingdom', 'childhood', 'friendship', 'happiness', 'kindness'],
    v: ['explore', 'discover', 'imagine', 'decide', 'arrive', 'borrow', 'gather', 'protect', 'invent', 'describe', 'believe', 'remember', 'whispered', 'stumbled', 'wondered', 'bought', 'froze'],
    a: ['enormous', 'fierce', 'clever', 'ancient', 'graceful', 'fragile', 'polite', 'peaceful', 'gigantic', 'nervous', 'careful', 'colorful', 'wooden', 'rocky', 'famous'],
    av: ['eagerly', 'gracefully', 'proudly', 'silently', 'rarely', 'finally', 'cheerfully', 'nervously', 'soon', 'often', 'politely', 'angrily'],
    pr: ['he', 'she', 'they', 'we', 'them', 'us', 'him', 'it'],
  },
  4: {
    n: ['adventure', 'climate', 'courage', 'invention', 'knowledge', 'character', 'audience', 'curiosity', 'ingredient', 'telescope', 'habitat', 'century', 'disaster', 'opinion', 'festival', 'prairie', 'glacier', 'freedom'],
    v: ['investigate', 'examine', 'predict', 'persuade', 'observe', 'compare', 'celebrate', 'contain', 'prepare', 'recognize', 'earned', 'admired', 'scurried', 'shrieked', 'wandered', 'pursue'],
    a: ['magnificent', 'cautious', 'anxious', 'generous', 'massive', 'delicate', 'humid', 'ferocious', 'stubborn', 'awkward', 'loyal', 'vivid', 'fortunate', 'suspicious', 'ordinary', 'invisible'],
    av: ['cautiously', 'anxiously', 'eventually', 'frequently', 'generously', 'immediately', 'fiercely', 'gradually', 'barely', 'seldom', 'abruptly', 'loyally'],
    pr: ['themselves', 'everyone', 'someone', 'nobody', 'himself', 'herself', 'ourselves'],
  },
  5: {
    n: ['ambition', 'strategy', 'evidence', 'democracy', 'ecosystem', 'generation', 'ancestor', 'portrait', 'harmony', 'patience', 'avalanche', 'laboratory', 'anxiety', 'society', 'meteorite', 'liberty', 'mystery', 'merchant'],
    v: ['analyze', 'construct', 'demonstrate', 'accomplish', 'interrupt', 'negotiate', 'illustrate', 'eliminate', 'hesitate', 'abandon', 'cooperate', 'transform', 'conclude', 'emerge', 'clarified', 'persuaded', 'acquire'],
    a: ['tremendous', 'reluctant', 'ambitious', 'hilarious', 'sincere', 'eager', 'vast', 'spontaneous', 'elegant', 'remarkable', 'obvious', 'immense', 'precise', 'cooperative', 'flexible', 'drowsy'],
    av: ['reluctantly', 'thoroughly', 'precisely', 'sincerely', 'occasionally', 'deliberately', 'instantly', 'briskly', 'furiously', 'nearly', 'constantly', 'obviously'],
    pr: ['whoever', 'anyone', 'somebody', 'whom', 'yourself', 'itself', 'everybody'],
  },
  6: {
    n: ['hypothesis', 'dilemma', 'integrity', 'perspective', 'catastrophe', 'expedition', 'tolerance', 'sanctuary', 'mythology', 'prejudice', 'empathy', 'vocabulary', 'civilization', 'apprehension', 'philosophy', 'testimony'],
    v: ['accumulate', 'contradict', 'emphasize', 'fluctuate', 'generalize', 'justify', 'manipulate', 'scrutinize', 'speculate', 'summarize', 'validate', 'deteriorate', 'provoke', 'exaggerate', 'comprehend', 'anticipate'],
    a: ['meticulous', 'conspicuous', 'diligent', 'eloquent', 'indifferent', 'inevitable', 'plausible', 'resilient', 'ominous', 'vulnerable', 'versatile', 'tedious', 'adequate', 'arrogant', 'frugal', 'lethargic'],
    av: ['meticulously', 'inevitably', 'ironically', 'subsequently', 'simultaneously', 'vaguely', 'inadvertently', 'persistently', 'relentlessly', 'candidly', 'hastily', 'diligently'],
    pr: ['oneself', 'yourselves', 'anything', 'nothing', 'something', 'whomever'],
  },
  7: {
    n: ['ambiguity', 'benevolence', 'consequence', 'discrepancy', 'hierarchy', 'hypocrisy', 'infrastructure', 'jurisdiction', 'momentum', 'nostalgia', 'paradox', 'precedent', 'propaganda', 'reconciliation', 'sovereignty', 'turmoil', 'anecdote', 'adversary'],
    v: ['circumvent', 'coerce', 'corroborate', 'deduce', 'discern', 'disseminate', 'enumerate', 'exacerbate', 'facilitate', 'infer', 'mitigate', 'perceive', 'reiterate', 'substantiate', 'undermine', 'allocate', 'alleviate'],
    a: ['ambiguous', 'arduous', 'benevolent', 'cynical', 'dubious', 'fastidious', 'gregarious', 'impartial', 'meager', 'pragmatic', 'prudent', 'tenacious', 'trivial', 'ubiquitous', 'volatile', 'zealous', 'austere'],
    av: ['ambiguously', 'arduously', 'cynically', 'dubiously', 'impartially', 'pragmatically', 'prudently', 'tenaciously', 'begrudgingly', 'invariably', 'ostensibly', 'scarcely'],
    pr: ['none', 'others', 'whomever', 'anybody', 'nobody'],
  },
  8: {
    n: ['juxtaposition', 'connotation', 'dichotomy', 'euphemism', 'idiosyncrasy', 'ramification', 'subterfuge', 'conundrum', 'epiphany', 'hubris', 'pragmatism', 'rhetoric', 'anomaly', 'consensus', 'labyrinth', 'protagonist', 'catalyst'],
    v: ['ameliorate', 'capitulate', 'delineate', 'extrapolate', 'obfuscate', 'proliferate', 'repudiate', 'vindicate', 'relinquish', 'admonish', 'belittle', 'curtail', 'disparage', 'embellish', 'exonerate', 'perpetuate', 'reconcile'],
    a: ['ambivalent', 'belligerent', 'cacophonous', 'clandestine', 'ephemeral', 'fortuitous', 'gratuitous', 'inexorable', 'magnanimous', 'nonchalant', 'obsequious', 'perfunctory', 'quintessential', 'surreptitious', 'taciturn', 'unprecedented', 'verbose'],
    av: ['surreptitiously', 'nonchalantly', 'inexorably', 'belligerently', 'perfunctorily', 'magnanimously', 'emphatically', 'incessantly', 'unequivocally', 'vehemently', 'judiciously', 'categorically'],
    pr: ['whomever', 'themselves', 'whoever', 'anybody', 'everybody'],
  },
};

/* --------------------------------------------------------- sentences --
   Every word that could ever be a right answer is tagged:
     word/n  noun      word/v  verb      word/a  adjective
     word/av adverb    word/pr pronoun
   A trailing * (is/v*) means "counts if tapped, but never asked about on its
   own": helping and linking verbs, possessives like my and their, number
   words. Asking a first grader whether "is" is a verb is a trap, not a
   lesson, but a kid who taps it for "tap a verb" is still right.
   Untagged words (the, a, on, to, and...) are never an answer.
   `notes` explains the tricky ones after a miss. */
export const SENTENCES = {
  1: [
    'The big/a dog/n ran/v to the park/n.',
    'A happy/a girl/n ate/v a red/a apple/n.',
    'My/pr* cat/n sat/v on the soft/a bed/n.',
    'The tiny/a frog/n jumped/v into the pond/n.',
    'Dad/n made/v a yummy/a cake/n.',
    'The silly/a pig/n rolled/v in the mud/n.',
    'The tall/a tree/n has/v green/a leaves/n.',
    'A little/a bird/n sang/v a sweet/a song/n.',
    'The boy/n kicked/v the big/a ball/n.',
    'Mom/n read/v a funny/a book/n.',
    'The fluffy/a puppy/n licked/v my/pr* hand/n.',
    'The hot/a sun/n melted/v the snowman/n.',
    'The baby/n drank/v warm/a milk/n.',
    'Two/a* ducks/n swam/v in the cold/a lake/n.',
  ],
  2: [
    'The brave/a knight/n rode/v quickly/av to the castle/n.',
    'A grumpy/a bear/n slept/v quietly/av in the cave/n.',
    'The children/n laughed/v loudly/av at the silly/a clown/n.',
    'My/pr* sister/n carefully/av painted/v a colorful/a rainbow/n.',
    'The shiny/a rocket/n zoomed/v into space/n.',
    'The kitten/n gently/av touched/v the soft/a blanket/n.',
    'Our/pr* class/n planted/v tiny/a seeds/n in the garden/n.',
    'The hungry/a monkey/n grabbed/v a ripe/a banana/n.',
    'Snow/n fell/v softly/av on the quiet/a town/n.',
    'The spooky/a owl/n hooted/v at night/n.',
    'Grandpa/n slowly/av climbed/v the steep/a hill/n.',
    'The noisy/a puppies/n chased/v the ball/n happily/av.',
    'Sam/n always/av brushes/v his/pr* teeth/n.',
  ],
  3: [
    'She/pr carefully/av carried/v the fragile/a vase/n.',
    'The ancient/a castle/n stood/v on a rocky/a hill/n.',
    'They/pr explored/v the dark/a cave/n together/av.',
    'We/pr visited/v the museum/n yesterday/av.',
    'The clever/a fox/n tricked/v the hungry/a wolf/n.',
    'He/pr whispered/v a secret/n to his/pr* best/a friend/n.',
    'The enormous/a whale/n splashed/v the excited/a tourists/n.',
    'Friendship/n is/v* important/a to everyone/pr.',
    'The astronaut/n bravely/av stepped/v onto the moon/n.',
    'It/pr rained/v heavily/av during the parade/n.',
    'Our/pr* teacher/n told/v us/pr a funny/a story/n.',
    'The graceful/a dancer/n spun/v slowly/av across the stage/n.',
    'A fierce/a storm/n shook/v the old/a barn/n.',
    'Maria/n proudly/av showed/v them/pr her/pr* drawing/n.',
  ],
  4: [
    'The cautious/a explorer/n slowly/av crossed/v the icy/a river/n.',
    'Everyone/pr cheered/v when the team/n finally/av won/v.',
    'The scientist/n examined/v the unusual/a rock/n carefully/av.',
    'They/pr discovered/v a hidden/a tunnel/n beneath the library/n.',
    { s: 'Courage/n helped/v her/pr face/v the huge/a crowd/n.',
      notes: { face: 'Here "face" is something she does, so it is a verb. In "a happy face" it would be a noun.' } },
    { s: 'The friendly/a dog/n wagged/v its/pr* tail/n eagerly/av.',
      notes: { friendly: '"Friendly" ends in -ly, but it describes the dog, so it is an adjective. Not every -ly word is an adverb!' } },
    'A ferocious/a wind/n howled/v through the empty/a streets/n.',
    'The audience/n laughed/v at the clever/a joke/n.',
    'We/pr rarely/av see/v snow/n in the desert/n.',
    'The generous/a baker/n gave/v us/pr free/a bread/n.',
    'Lightning/n suddenly/av lit/v the stormy/a sky/n.',
    'The stubborn/a mule/n refused/v to move/v*.',
    'My/pr* grandmother/n knits/v warm/a scarves/n every winter/n.',
  ],
  5: [
    'The reluctant/a hero/n finally/av accepted/v the challenge/n.',
    'We/pr watched/v the fireworks/n from the roof/n.',
    { s: 'The team/n will/v* practice/v after school/n.',
      notes: { practice: 'Here "practice" is what the team will do, so it is a verb.' } },
    { s: 'Practice/n makes/v a player/n stronger/a.',
      notes: { Practice: 'Here "practice" is a thing that makes you stronger, so it is a noun. The same word can do different jobs.' } },
    'The hilarious/a comedian/n told/v jokes/n all night/n.',
    'She/pr answered/v the question/n confidently/av.',
    'Their/pr* ambitious/a plan/n surprised/v everyone/pr.',
    'The tired/a hikers/n rested/v beside a sparkling/a stream/n.',
    'Anyone/pr can/v* join/v the club/n today/av.',
    'The detective/n searched/v the room/n thoroughly/av.',
    'A huge/a avalanche/n buried/v the narrow/a road/n.',
    'Honesty/n is/v* always/av the best/a policy/n.',
    'He/pr quietly/av opened/v the creaky/a door/n.',
  ],
  6: [
    'The meticulous/a editor/n carefully/av reviewed/v every sentence/n.',
    'Her/pr* eloquent/a speech/n inspired/v the entire/a school/n.',
    'They/pr hastily/av packed/v their/pr* bags/n before the storm/n.',
    'The resilient/a village/n rebuilt/v after the flood/n.',
    'Nobody/pr expected/v such a sudden/a change/n.',
    'The scientist/n tested/v her/pr* hypothesis/n repeatedly/av.',
    { s: 'We/pr water/v the garden/n every morning/n.',
      notes: { water: 'Here "water" is something we do to the garden, so it is a verb.' } },
    { s: 'The hikers/n drank/v cold/a water/n from the spring/n.',
      notes: { water: 'Here "water" is the thing they drank, so it is a noun.' } },
    'The ominous/a clouds/n gathered/v over the valley/n.',
    'The candid/a reporter/n asked/v difficult/a questions/n.',
    { s: 'Their/pr* team/n played/v well/av despite the heavy/a rain/n.',
      notes: { well: '"Well" tells how they played, so it is an adverb.' } },
    'The frugal/a family/n saved/v money/n diligently/av.',
    { s: 'Something/pr strange/a happened/v at midnight/n.',
      notes: { strange: '"Strange" describes "something", so it is an adjective, even though it comes after the word it describes.' } },
    'The lethargic/a cat/n barely/av moved/v all afternoon/n.',
  ],
  7: [
    'The benevolent/a king/n generously/av pardoned/v the prisoners/n.',
    { s: 'Running/n is/v* her/pr* favorite/a exercise/n.',
      notes: { Running: '"Running" is an -ing verb acting as a thing here (the subject of the sentence). That makes it a noun, called a gerund.' } },
    { s: 'The running/a water/n soothed/v the tired/a travelers/n.',
      notes: { running: '"Running" describes the water here, so it is working as an adjective (a participle).' } },
    'The dubious/a claim/n puzzled/v the investigators/n.',
    'Investigators/n could/v* not/av* corroborate/v the story/n.',
    'Her/pr* pragmatic/a approach/n solved/v the problem/n quickly/av.',
    'The volatile/a market/n rose/v sharply/av, then/av* fell/v.',
    { s: 'The arduous/a journey/n tested/v their/pr* resolve/n.',
      notes: { resolve: 'Here "resolve" means determination, a thing they have, so it is a noun.' } },
    { s: 'They/pr resolve/v conflicts/n calmly/av.',
      notes: { resolve: 'Here "resolve" is what they do to conflicts, so it is a verb.' } },
    'The gregarious/a host/n greeted/v each guest/n warmly/av.',
    'Nostalgia/n overwhelmed/v him/pr at the reunion/n.',
    'A tenacious/a lawyer/n rarely/av abandons/v a case/n.',
    { s: 'The excited/a fans/n rushed/v the field/n.',
      notes: { excited: '"Excited" looks like a past-tense verb, but here it describes the fans, so it is an adjective.' } },
  ],
  8: [
    'The clandestine/a meeting/n ended/v abruptly/av at dawn/n.',
    'His/pr* nonchalant/a attitude/n annoyed/v the coach/n.',
    { s: 'Swimming/n in cold/a water/n requires/v courage/n.',
      notes: { Swimming: '"Swimming" is the subject of the sentence, the thing that requires courage. An -ing verb used as a noun is a gerund.' } },
    'The ephemeral/a beauty/n of the sunset/n amazed/v us/pr.',
    'Critics/n harshly/av disparaged/v the unprecedented/a decision/n.',
    'The protagonist/n finally/av confronts/v her/pr* fears/n.',
    { s: 'Hope/n is/v* a powerful/a catalyst/n.',
      notes: { Hope: 'Here "hope" is a thing (an idea), so it is a noun.' } },
    { s: 'We/pr hope/v the verdict/n will/v* exonerate/v the defendant/n.',
      notes: { hope: 'Here "hope" is what we do, so it is a verb.' } },
    'The taciturn/a guard/n answered/v only/av* in grunts/n.',
    'An unexpected/a epiphany/n transformed/v her/pr* work/n.',
    'The belligerent/a crowd/n shouted/v angrily/av outside/av*.',
    'Powerful/a rhetoric/n can/v* sway/v undecided/a voters/n.',
    { s: 'The broken/a promise/n deepened/v their/pr* distrust/n.',
      notes: { broken: '"Broken" is a verb form, but here it describes the promise, so it is an adjective.' } },
    'Everybody/pr listened/v intently/av to the verbose/a speaker/n.',
  ],
};

/* -------------------------------------------------------------- spelling --
   word | wrong spellings | sentence with ___ where the word goes.
   A leading ~ marks a sound-alike (their/there/they're): the other choices
   are real words and the sentence decides which one fits.
   Wrong spellings are hand-written to be the mistakes kids actually make
   (dropped silent letters, ie/ei swaps, doubled or single consonants), not
   random letter noise that nobody would ever pick. */
export const SPELLING = {
  1: [
    'cat|kat,catt|The ___ purred on my lap.',
    'said|sed,siad|Mom ___ it was time for bed.',
    'was|wuz,waz|The cake ___ yummy.',
    'they|thay,tey|___ went to the zoo.',
    'friend|freind,frend|My ___ came over to play.',
    'have|hav,haf|I ___ a red kite.',
    'come|cum,kome|Please ___ to my party.',
    'what|wut,whut|___ is your name?',
    'jump|jupm,jumpe|I can ___ very high.',
    'play|pley,plai|Let\'s ___ outside.',
    'house|hous,howse|We live in a blue ___.',
    'little|littel,litle|The ___ mouse ran away.',
    'green|grean,gren|Grass is ___.',
    'down|doun,dowen|The ball rolled ___ the hill.',
    'there|thare,ther|Put the box over ___.',
    'where|wher,whare|___ is my shoe?',
    'could|cud,coud|She ___ see the moon.',
    'school|skool,scool|I ride the bus to ___.',
    'fish|fesh,fisch|The ___ swam in the bowl.',
    'of|uv,ov|I want a glass ___ milk.',
  ],
  2: [
    'again|agen,agian|Can we play that game ___?',
    'animal|aminal,animul|A giraffe is a tall ___.',
    'before|befor,bifore|Wash your hands ___ you eat.',
    'birthday|brithday,birfday|My ___ party is on Saturday.',
    'different|diffrent,diferent|My socks are ___ colors.',
    'enough|enuff,enogh|Do we have ___ cups for everyone?',
    'favorite|favrite,faverite|Pizza is my ___ food.',
    'laugh|laf,lauf|The clown made us ___.',
    'people|peeple,poeple|Lots of ___ came to the show.',
    'pretty|pritty,prety|She picked a ___ flower.',
    'thought|thougt,thot|I ___ it would rain today.',
    'together|togather,togethr|We built the fort ___.',
    'until|untill,untel|Wait ___ the light turns green.',
    'when|wen,whenn|___ does the movie start?',
    'very|verry,vairy|It was a ___ cold day.',
    '~would|wood,wud|I ___ like some juice, please.',
    '~their|there,they\'re|The kids put on ___ coats.',
    '~too|to,two|I want to come ___!',
    '~knew|new,knoo|I ___ the answer right away.',
    '~write|right,rite|Please ___ your name on the paper.',
  ],
  3: [
    'beautiful|beutiful,beautifull,butiful|What a ___ sunset!',
    'believe|beleive,beleve|I ___ you can do it.',
    'caught|cought,caugt|The dog ___ the frisbee.',
    'decided|desided,decidded|We ___ to go swimming.',
    'excited|excitted,exsited|I am so ___ for summer!',
    'February|Febuary,Februery|Valentine\'s Day is in ___.',
    'island|iland,islend|The pirates sailed to a small ___.',
    'library|libary,liberry|I borrowed a book from the ___.',
    'minute|minit,minnute|Wait one ___, please.',
    'neighbor|nieghbor,naybor|Our ___ has a big dog.',
    'question|questoin,qestion|Raise your hand if you have a ___.',
    'really|realy,reely|That was ___ fun!',
    'surprise|suprise,surprize|We planned a ___ party.',
    'tomorrow|tommorow,tomorow|___ is Saturday.',
    'answer|anser,answar|Do you know the ___?',
    'through|thru,throgh|The train went ___ the tunnel.',
    'special|speshal,specail|Today is a ___ day.',
    '~they\'re|their,there|___ going to the beach today.',
    '~hear|here,heer|Did you ___ that noise?',
    '~whole|hole,hoal|She ate the ___ pizza by herself.',
  ],
  4: [
    'although|allthough,altho|___ it was raining, we played outside.',
    'beginning|begining,beggining|The ___ of the story was exciting.',
    'business|buisness,bussiness|My aunt runs a small ___.',
    'calendar|calender,calandar|Mark the date on the ___.',
    'character|charactor,caracter|The main ___ is a brave mouse.',
    'disappear|dissapear,disapear|The magician made the coin ___.',
    'especially|expecially,especialy|I love fruit, ___ strawberries.',
    'experience|experiance,expirience|Camping was a great ___.',
    'government|goverment,govermint|The ___ makes laws.',
    'guess|gess,guesse|Can you ___ my secret?',
    'height|heighth,hieght|What is the ___ of that tower?',
    'interesting|intresting,interisting|That book was very ___.',
    'knowledge|knowlege,knowladge|Reading builds your ___.',
    'occasion|ocassion,occassion|A wedding is a special ___.',
    'probably|probly,probablly|It will ___ snow tonight.',
    'remember|rember,remeber|I will ___ your birthday.',
    'weird|wierd,weerd|That was a ___ dream.',
    '~piece|peace,peice|May I have a ___ of cake?',
    '~its|it\'s,its\'|The dog wagged ___ tail.',
    '~your|you\'re,yore|Is this ___ backpack?',
  ],
  5: [
    'accidentally|accidently,accidentaly|I ___ spilled my juice.',
    'achieve|acheive,acheeve|You can ___ your goals with practice.',
    'apparent|apparant,aparent|It was ___ that the dog was hungry.',
    'cemetery|cemetary,cematery|The old ___ had tall trees.',
    'definitely|definately,definitly|I will ___ come to your game.',
    'embarrass|embarass,embarras|Please don\'t ___ me in front of my friends.',
    'environment|enviroment,environmint|We should protect the ___.',
    'foreign|foriegn,forein|She speaks a ___ language.',
    'immediately|immediatly,imediately|Come here ___!',
    'necessary|neccessary,necesary|Is it ___ to bring a lunch?',
    'occurred|occured,ocurred|The accident ___ last night.',
    'privilege|privelege,priviledge|Voting is a ___ and a duty.',
    'receive|recieve,receeve|Did you ___ my letter?',
    'restaurant|resturant,restaraunt|We ate dinner at a fancy ___.',
    'separate|seperate,separete|Keep the red and blue beads ___.',
    'tongue|tounge,tung|The frog caught a fly with its ___.',
    'vacuum|vaccum,vacume|Please ___ the living room rug.',
    'sincerely|sincerly,sincerelly|She signed the letter "Yours ___."',
    '~affect|effect,afect|Loud noise can ___ your hearing.',
    '~principal|principle,principel|The ___ gave a speech at the assembly.',
  ],
  6: [
    'acquaintance|aquaintance,acquaintence|He is an old ___ of my dad.',
    'amateur|amatuer,amature|She is an ___ photographer.',
    'committee|comittee,committe|The ___ voted on the new rules.',
    'conscience|concience,conscence|My ___ told me to tell the truth.',
    'conscious|concious,consious|Be ___ of how you speak to others.',
    'discipline|dicipline,disapline|Learning piano takes ___.',
    'exaggerate|exagerate,exaggarate|Don\'t ___; it was only a small fish.',
    'fluorescent|flourescent,florescent|The ___ lights buzzed overhead.',
    'guarantee|guarentee,garantee|We ___ you will love it.',
    'humorous|humerous,humourus|The ___ story made everyone laugh.',
    'independent|independant,indipendent|She is very ___ and likes to do things herself.',
    'leisure|liesure,leasure|Reading is my favorite ___ activity.',
    'lieutenant|leutenant,lieutenent|The ___ gave orders to the soldiers.',
    'millennium|millenium,milennium|The year 2000 began a new ___.',
    'mischievous|mischievious,mischevous|The ___ puppy chewed my shoe.',
    'noticeable|noticable,noticeble|The stain was barely ___.',
    'parallel|paralell,parrallel|The two lines are ___.',
    'rhythm|rythm,rhythym|Clap along to the ___.',
    '~than|then,thann|My brother is taller ___ me.',
    '~accept|except,acept|I ___ your apology.',
  ],
  7: [
    'accommodate|accomodate,acommodate|The hotel can ___ fifty guests.',
    'bureaucracy|beaurocracy,burocracy|Getting the permit meant a lot of ___.',
    'changeable|changable,chaingeable|The weather in spring is ___.',
    'conscientious|consciencious,conscientous|A ___ student checks her work twice.',
    'connoisseur|conoisseur,connoiseur|He is a ___ of fine cheese.',
    'harass|harrass,harras|It is wrong to ___ other people.',
    'hierarchy|heirarchy,hierarchey|The company has a strict ___.',
    'indispensable|indispensible,indespensable|A good map is ___ on a hike.',
    'liaison|liason,liasion|She acts as a ___ between the two teams.',
    'maneuver|manuever,manouver|The pilot made a tricky ___.',
    'occurrence|occurence,ocurrence|Rain is a common ___ here in April.',
    'perseverance|perseverence,perserverance|___ helped her finish the marathon.',
    'pneumonia|pnuemonia,neumonia|He stayed home sick with ___.',
    'questionnaire|questionaire,questionnare|Please fill out the ___.',
    'recommend|reccommend,recomend|I ___ the chocolate cake.',
    'silhouette|silhouete,silouette|We saw the ___ of a cat in the window.',
    'supersede|supercede,superseed|The new rule will ___ the old one.',
    'threshold|threshhold,thresold|She paused at the ___ of the door.',
    '~compliment|complement,complemint|He paid me a nice ___ on my drawing.',
    '~stationary|stationery,stationairy|The car remained ___ at the red light.',
  ],
  8: [
    'camouflage|camoflage,camouflauge|The lizard\'s ___ hid it on the rock.',
    'catastrophe|catastrophy,catastrofe|The flood was a ___ for the town.',
    'colleague|collegue,colleage|My mom had lunch with a ___.',
    'entrepreneur|entrepeneur,entreprenuer|The young ___ started a lemonade company.',
    'existence|existance,existince|Scientists debate the ___ of life on Mars.',
    'idiosyncrasy|idiosyncracy,idiosincrasy|Humming while he works is his ___.',
    'inoculate|innoculate,inocculate|Doctors ___ children against measles.',
    'irresistible|irresistable,iresistible|The smell of fresh bread was ___.',
    'memento|momento,mementoe|She kept the ticket as a ___ of the trip.',
    'miniature|miniture,minature|He built a ___ train set.',
    'misspell|mispell,misspel|It is easy to ___ this word.',
    'onomatopoeia|onomatopeia,onomatopoea|"Buzz" is an example of ___.',
    'playwright|playwrite,playright|The ___ wrote three new scenes.',
    'pronunciation|pronounciation,pronunciasion|Her ___ of French words is excellent.',
    'unnecessary|unneccessary,unecessary|Bringing a coat was ___; it was warm.',
    'withhold|withold,witthold|Do not ___ important information.',
    'rhythmic|rythmic,rhythmick|The ___ drumming made us dance.',
    'embarrassment|embarassment,embarrasment|His face turned red with ___.',
    '~elicit|illicit,elicet|The joke failed to ___ a single laugh.',
    '~allusion|illusion,alusion|The poem makes an ___ to a Greek myth.',
  ],
};

/* Glove colours a new boxer can pick. */
export const GLOVES = ['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#a855f7', '#ec4899'];
