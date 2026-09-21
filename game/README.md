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
