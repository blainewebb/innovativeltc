# Word Kick

A penalty shootout for grades 1-8 where English is the kick. Word Punch's
questions, one grade easier, on a soccer pitch. Beat eight teams across three
cups to win the Golden Cup for your grade.

Static site, no build step, no accounts, no network calls. Works offline once
loaded. Several kids can share one device with separate players.

## How a shootout works

- Five kicks each, you first.
- **Your kick:** answer right and you score. Answer in the first third of the
  clock and it goes in the top corner.
- **Their kick:** you're in goal. Answer right and you make the save. Wrong or
  too slow and it's in.
- Real shootout rules: it ends as soon as one side can't catch up, and a tie
  after five goes to **sudden death** (a kick each until one scores and the
  other doesn't).
- After a miss, the game shows the right answer and a one-line reason, and
  waits for a "Got it!" tap.
- **3 right in a row earns a star** (up to 3). Tap "Use a star" during a
  question to clear away wrong answers: multiple choice drops to the right
  answer and one wrong one, tap-a-word keeps two wrong words.
- **Good keepers:** the last four teams have keepers who save a right answer
  given at the very end of the clock (last 15% to 30%, shown as a striped zone
  on the timer). With the clock turned off this never happens.

## One grade easier than Word Punch

| player grade | questions from | notes |
| --- | --- | --- |
| 1 | 1st grade | 3 choices instead of 4, longest clock |
| 2 | 1st grade | |
| 3 | 2nd grade | no pronouns yet (Word Punch starts them in 3rd) |
| 4-8 | the grade below | |

Each content grade also mixes in the grade below it, same as Word Punch. The
clock runs a couple of seconds longer than Word Punch at the same grade.
Read-aloud is on by default while the questions are 1st or 2nd grade level
(player grades 1-3).

## The ladder

| cup | teams | trophy |
| --- | --- | --- |
| Local | Noun City FC, Spelling Rovers, Adjective Athletic | Local Cup |
| Continental | Pronoun Palace, Adverb United, Verbton Wanderers | Continental Cup |
| Golden | Dictionary Dynamo, Grammar Galaxy FC | Golden Cup |

Each team leans on something: Noun City throws nouns, Spelling Rovers and
Dictionary Dynamo throw mostly spelling, Verbton Wanderers throw verbs. A team
that leans on something the grade doesn't teach yet (pronouns before 3rd grade
content) just throws a normal mix.

## Kits

Players pick national team colors: Argentina, Brazil, USA, Mexico, England,
France, Germany, Spain, Italy, Portugal, Netherlands, Croatia, Japan, Canada,
Nigeria, Scotland. Colors and patterns only, no crests or logos. Name and
shirt number show on the back. Kit and number can be changed in Coach's
Corner.

## Shared content with Word Punch

Word Kick has no word lists of its own. It imports them, and the question
builders, from `../wordpunch/js/`. A fix to a word or sentence in Word
Punch's `data.js` fixes both games, and a mistake there shows up in both.
Run both test suites after editing it.

## Running it

Serve the **repo root**, not this folder, since the game loads `../wordpunch`:

```
python3 -m http.server 8126
# then visit http://127.0.0.1:8126/wordkick/
```

On GitHub Pages it installs to a phone or tablet home screen and works offline
after the first load (the service worker caches the Word Punch files it
needs). Progress lives in that browser's `localStorage`.

## Tests

```
./test/run.sh
```

- `test/engine.test.mjs`: the grade shift (grade 3 only sees grade 1-2 words,
  no pronouns; grade 1 gets 3 choices), every question format at every grade
  and rung has exactly one right answer, star help never removes the right
  answer, shootout rules (early finish, sudden death, quick and slow kicks,
  timeouts, stars), trophies and ladder progress, saves with junk data.
- `test/play.test.mjs`: plays in Chromium. Makes a player, wins, loses on
  purpose, wins the Local Cup, reloads, uses a star, changes kit, runs the
  clock out, adds a second player, and checks a goal puts the ball in the net.

## Files

| file | what it holds |
| --- | --- |
| `js/data.js` | teams, cups, kits, the grade shift |
| `js/engine.js` | building kicks from Word Punch's content, shootout rules, profile |
| `js/main.js` | every screen and the shootout loop |
| `js/art.js` | shirts, players, keepers, goal, crests, trophies as inline SVG |
| `js/storage.js` | players in localStorage |
| `js/sfx.js` | WebAudio sounds (whistle, kick, net, crowd) |

Bump `VERSION` in `js/data.js` and `CACHE` in `sw.js` together when shipping.
