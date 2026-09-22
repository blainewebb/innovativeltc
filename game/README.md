# Runebreaker

A math roguelike for kids roughly 7-11. Built because Prodigy-style games put the
math in front of the fun as a toll gate, which teaches kids to rush the questions
to get to the game. Here the arithmetic **is** the move.

Static site, no build step, no accounts, no network calls. Works offline once
loaded. Two or more kids share one device through separate hero profiles.

## How the game works

A run is 20 floors. Each floor offers a choice of 2-3 nodes (monster, elite,
riddle shrine, locked chest, trader, campfire), with a boss every fifth floor.
Clear floor 20 and you win the run, which unlocks an endless mode. Die and you
start over, keeping only your learning record and a small permanent health bonus.

### The combat loop

You hold a hand of number tiles and the operator runes you have earned. On your
turn you pick **tile, rune, tile**, then **type the answer yourself**. The result
is your damage.

Three things make this different from a quiz with a sword on top:

1. **Nothing is multiple choice.** The kid produces a number or nothing happens.
   There is no list to guess from and no way to click through.
2. **The biggest number is usually the wrong play.** Enemies carry three things,
   all printed on their card: **armor** (flat reduction), a **ward** that doubles
   or triples matching results, and a **resist** that punishes overshooting.

   A real example taken straight out of the game. Hand of `5, 2, 12, 8, 8`
   against a Remainder Knight with armor 44, "square numbers hit TRIPLE", and
   "results over 103 barely scratch it":

   | play | result | damage |
   | --- | --- | --- |
   | `12 x 8` (the biggest) | 96 | 52 |
   | `8 x 8` (a square) | 64 | **148** |

   The smaller number hits nearly three times harder. Working out which play
   wins means computing several of them in your head first, which is the entire
   point of the design.

   Resists exist specifically because multiplication hands a kid a damage
   ceiling ten times higher than addition. Without them, "multiply the two
   biggest tiles" is correct four turns in five and the thinking disappears.
   There is a test that measures this and fails the build if the obvious play
   stops being wrong often enough (`the biggest number is often NOT the best
   play`, currently about half of all turns).
3. **Exact-target shields.** Some enemies raise a shield that only breaks on an
   exact result, so the kid has to search their hand for a combination that makes
   a specific number. Shield targets are always numbers their current tile range
   can actually produce.

A wrong answer deals no damage, ends the turn, resets the combo, and shows the
correct answer plus a one-line strategy hint ("7 x 8 is 7 x 4 doubled: 28 + 28").
The tiles stay in hand so the next turn is a chance to redo the same fact having
just been told the answer. Getting it wrong costs you the fight, slowly, which is
real pressure without a wall.

### Drill turns

Turns alternate. On a **built turn** the player picks the numbers, which is
where the thinking is. On a **drill turn** the game picks, and it picks what
they have been avoiding.

That second half exists because the first half has a hole: when the kid chooses
every play, a kid who hates `7 x 8` can go a whole run without ever making
`7 x 8`. The hand generator stacks the deck toward their weak skills but cannot
force the shot. Drill turns can.

A drill shows the enemy's telegraphed move, a problem, and a draining clock.
Answer in time and you **parry** the move and **counter** for damage equal to
your answer. Miss, or run out of time, and the move lands, the combo resets,
and you get the correct answer plus a strategy hint.

Two deliberate limits:

- **The counter gets no ward or resist bonus.** The player did not choose the
  number, so the reward is for speed and accuracy alone. A well-chosen built
  strike can triple its damage off a ward; a drill counter never can. That
  keeps the thinking half of the game the half with the high ceiling.
- **The clock comes from the child, not from a constant.** The allowance is
  their own average time for that kind of problem, plus a moment to read it,
  clamped to 4-20 seconds. A quicker kid gets real pressure, a slower one gets
  a fair window, and the window tightens by itself as they improve. A fixed
  countdown would be trivial for one and demoralising for the other.

There is a real argument in maths education that timed drills feed maths
anxiety, associated most publicly with Jo Boaler's work on timed testing. It is
contested rather than settled. The design takes it seriously rather than
dismissing it: the clock is personal rather than fixed, a miss costs damage in
a fight rather than producing a failure screen, and **drills can be switched
off per hero** from the grown-up screen, so one kid can have them and their
brother can not.

Balance is measured rather than guessed. A bot with perfect instant recall
currently clears about 38% of its runs, with deaths spread across the back half
rather than walling early. Getting there took several wrong turns worth
recording: parrying for free made the bot clear every run; budgeting duels like
ordinary fights made them twice as long and killed it on floor 3; and one
apparent difficulty spike turned out to be the test harness being slower than
the in-game clock, which is why the soak now asserts its own answer latency.

### Boss duels

A boss every third floor, plus one on the final floor. A duel is nothing but
asked questions: no tile building at all, the whole fight is the drill turn.

Two clocks run. Each question has the personal clock drill turns already use,
and the duel as a whole has one. Running the duel clock out does not end
anything: the boss **enrages** and hits twice as hard, so a slow fight gets
dangerous rather than lost.

Three things a duel does differently, all for the same reason, that the player
is answering rather than choosing:

- **No ward and no resist.** Both reward aiming for a particular number, which
  is impossible when the number is handed to you. They are hidden rather than
  shown and quietly ignored.
- **No jam and no shield.** There are no tiles to jam, and a shield demanding
  an exact number cannot be met by a number you did not pick. Both would be
  free turns dressed up as threats.
- **Health budgeted against what an answer is worth**, by sampling the drill
  picker, rather than against the much higher ceiling of a well-chosen built
  strike. Budgeting a duel the normal way made it run about twice its intended
  length, and those extra turns were extra damage taken.

A parry blunts a blow rather than stopping it: 40% still lands. That costs only
a player who is parrying everything, since a kid who misses takes the full hit
either way. It raises the ceiling without touching the floor.

### Adaptation

Every attempt is classified into a skill (`add_small`, `mult_hard`, `div_easy`
and so on) and into a specific fact (`7*8`). Both are tracked with an exponential
moving average, so recent work dominates, plus average response time.

- **Hands are aimed.** The tile generator seeds each hand with a pair that makes
  the kid's *weakest* available skill the attractive play.
- **Operator runes unlock in order.** Multiplication appears once addition is
  solid, division once multiplication is. A run starts with every operator the
  kid has already earned. Nobody who knows their times tables grinds addition.
- **Hands target a known weakness, not an untouched one.** A skill the kid has
  never tried scores zero, so naively taking the minimum would aim at whatever
  they have never seen and never revisit the fact they keep missing. Known-weak
  wins, with an occasional deliberate introduction of something new.
- **Enemy stats are budgeted, not hand-written.** Health, armor, resist
  thresholds and damage are all derived from the largest hit the player can
  realistically produce right now, so a fight is 3-7 turns whether they are
  adding single digits or multiplying twelves. Difficulty tracks the child, not
  the floor number.

Because a wrong answer costs a turn and every turn costs health, the run length
is directly coupled to arithmetic accuracy. A kid who guesses dies on floor 4.

## The grown-up report card

Tap "Grown-ups" and answer 23 x 17. Inside, per hero:

- a bar per skill combining accuracy and speed, weighted to recent answers, held
  low until there are enough attempts to judge
- the specific facts they are worst at, with accuracy and average time
- a flag for facts answered **fast and wrong**, which is usually guessing rather
  than a gap in knowledge
- total time played and a 14-day activity strip

Everything stays in `localStorage` on the device. Nothing is uploaded.

## Heroes

Making a hero asks for a **school year**, 1st through 5th. It is asked as a US
grade rather than an age because age predicts very little: two eight year olds
can be two years apart on times tables. The grade only sets where they start,
opening the operators that year is taught and lifting the first few runs off
level 1. Its influence then erodes by one level every 30 answers, so within
roughly 150 problems the child's own record is the only thing setting
difficulty. A wrong guess corrects itself in either direction, and it is a
floor rather than a ceiling, so a kid who races ahead is never held back by
what was ticked in September.

Heroes are deleted from the picker: **Manage heroes**, then the cross beside
one. It says how many problems and minutes are about to be lost and offers to
back the hero up first, because it is the one irreversible action in the game.

Several kids share one device through separate heroes. Each hero has its own
learning record, its own difficulty level, its own unlocked operators, its own
drill setting and its own section of the report card. Nothing is shared between
them.

Add one from the picker: on the hub, **Switch / add hero**, then **Add another
hero** at the bottom of the list. Give each kid their own rather than sharing
one, or the adaptation averages two children together and targets neither.

## Where progress lives, and moving it

There is no account and no server, which is what makes the game work offline
with nothing to maintain. The cost is that a hero exists in exactly one browser
on one device. Phone Safari, phone Chrome and a laptop are three separate sets
of heroes, and on iOS a home-screen web app has its own storage container
separate from the Safari tab, so even those two are different.

**Install it to the home screen rather than bookmarking it.** Safari's tracking
prevention deletes script-written storage for sites not visited in seven days,
which would wipe a hero over a school holiday. Installed web apps are exempt.
That is WebKit's documented ITP behaviour rather than something measured here,
so treat it as a good reason to install rather than a guarantee.

Because of all that, the grown-up screen has **Back up / move** per hero and
**Bring a hero in**. A backup is a small JSON file holding the whole record:
heroes, progress, and everything the report card is built from. Both a file
download and a copyable text box are offered on every screen, because downloads
and file pickers are not reliable inside an installed web app on every phone
while copy and paste always is.

Importing a hero who already exists on the device asks before doing anything:
use the backup, or keep both as separate heroes. It never merges two divergent
learning records, because combining them would invent attempts that never
happened. `normalizeProfile` fills in anything missing from an older export, so
a backup taken before a skill existed still loads with that skill blank rather
than crashing the report card later.

## Running it

It is a static folder. Open `index.html` through any web server:

```
cd game
python3 -m http.server 8124
# then visit http://127.0.0.1:8124/
```

It will not run from `file://` because it uses ES modules.

Deployed on GitHub Pages it installs to a phone or tablet home screen (Share →
Add to Home Screen on iOS, the install prompt on Android) and works with no
connection after the first load.

## Tests

```
./test/run.sh
```

- `test/storage.test.mjs` — backup and restore: round trips, older exports,
  hand-edited junk, and that a bad file fails with a message a parent can act
  on rather than a stack trace.
- `test/engine.test.mjs` — pure logic: skill classification, mastery maths, hand
  generation, the damage formula, the balance budget, riddle generators. No
  browser needed.
- `test/play.test.mjs` — drives a real Chromium session: makes a hero, fights,
  answers right and wrong, checks the report card and that progress survives a
  reload.
- `test/soak.test.mjs` — a bot plays a dozen full runs, reading each enemy card
  and answering perfectly. It catches runtime errors on every screen and keeps
  the balance honest: it should clear floor 20 roughly half the time. Because it
  picks its play only from what is printed on screen, it also proves the card
  tells a player enough to play well. An earlier version of the bot that just
  multiplied the two biggest tiles died on every single run, which is the
  clearest evidence the mechanics reward thinking.

## Files

| file | what it holds |
| --- | --- |
| `js/data.js` | skills, enemy templates, wards, relics, word-problem generators |
| `js/engine.js` | mastery tracking, adaptation, damage, enemy budget, map, runs |
| `js/main.js` | every screen, input handling, the run state machine |
| `js/storage.js` | hero profiles in localStorage |
| `js/sfx.js` | WebAudio blips, no audio files to download |

`data.js` and `engine.js` never touch the DOM, which is why the logic is testable.

## Adding English

The structure already allows it and nothing here is math-specific except the
content. The shortest path:

1. Add English skills to `SKILLS` in `data.js` (`spelling`, `vocab_context`,
   `grammar_fix`, `reading_detail`).
2. Add a word-encounter type alongside `battle` in `generateFloor`, where the
   move is choosing and typing a word rather than a number. The damage formula in
   `computeDamage` takes a number, so an obvious mapping is word length or a
   letter-value score, which keeps the ward and armor mechanics working unchanged.
3. Teach `askNumber` a text sibling for typed word answers.

The report card, adaptation and profile storage pick up new skills automatically
from the `SKILLS` list.
