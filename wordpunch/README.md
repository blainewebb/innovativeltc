# Word Punch

A boxing game for grades 1-8 where English is the punch. Answer right and you
land a hit. Answer wrong, or too slowly, and you take one. Beat eight boxers
across three circuits to win the World Championship Belt for your grade.

Static site, no build step, no accounts, no network calls. Works offline once
loaded. Several kids can share one device with separate boxers.

To change players, tap **Switch boxer** at the top of the ladder (or at the
bottom of Coach's Corner). The list that opens also has **Add another boxer**.

## How a fight works

- Each turn the opponent winds up a punch and a question appears with a clock.
- **Right answer:** you dodge and counter. Answering in the first third of the
  clock is a QUICK hit for a bit more damage.
- **Wrong or too slow:** you get hit, and the game shows the right answer and a
  one-line reason. It waits for a "Got it!" tap so the lesson doesn't flash past.
- **3 right in a row earns a star** (up to 3). Arm a star before answering for a
  POWER PUNCH worth 2.5 normal hits. Miss with it armed and the star is gone.
- **Knocked down?** Answer one question right to get back up. Two tries before
  the count runs out. Three knockdowns is a TKO.
- Circuit champions get back up once, so title fights take two knockdowns.

## The ladder

| circuit | fighters | belt |
| --- | --- | --- |
| Minor | Lowercase Larry, Vowel Vinnie, Captain Capital | Minor Circuit Belt |
| Major | Silent Steve, Madame Adjectiva, The Great Verbini | Major Circuit Belt |
| World | Dr. Dictionary, King Grammaticus | World Championship Belt |

Every grade has its own ladder and its own three belts, so there are 24 belts in
all. Beating King Grammaticus offers the next grade up. Each fighter leans on
something: Vowel Vinnie and Dr. Dictionary throw mostly spelling, Madame
Adjectiva throws adjectives, The Great Verbini throws verbs.

Fighter stats come from their place on the ladder, not per-fighter numbers: the
first needs 4 right answers to drop, the King needs 8 plus a second knockdown,
and the clock shortens a little each rung. The clock also starts longer for
younger grades (22 seconds in 1st grade, 12 in 8th).

## What it asks

| format | example | appears |
| --- | --- | --- |
| Pick the word | "Which word is a NOUN?" four loose words | every fight |
| Name it | "What part of speech is the highlighted word?" | every fight |
| Tap it | "Tap the VERB." in a whole sentence | from the 3rd fighter (2nd grade up) |
| Spell it | "Which spelling is right?" with the sentence for meaning | every fight |
| Fix it | "One word is spelled wrong. Tap it!" | Major Circuit up, 4th grade up |

Parts of speech by grade: nouns, verbs and adjectives from 1st grade, adverbs
from 2nd, pronouns from 3rd. That order follows when the Common Core language
standards introduce them (L.1.1, L.2.1, L.3.1). Schools vary, so treat it as a
reasonable default, not a match for any particular curriculum.

Each grade also pulls in some of the grade below at a lower rate, so earlier
material keeps coming back.

Upper grades include the tricky cases on purpose: the same word doing two jobs
("We **water** the garden" vs "drank cold **water**"), -ly words that are
adjectives ("friendly"), gerunds ("**Running** is her favorite exercise"), and
sound-alikes (their / there / they're, affect / effect, compliment / complement).
Each of those carries its own explanation.

### About the content

All word lists, sentences and misspellings in `js/data.js` are hand-written.
Grade placement is a judgment call based on typical US spelling and vocabulary
lists, not a specific published list. Worth a read-through by a teacher before
relying on it for a particular class.

Loose words ("Which word is a NOUN?") are only words that are one part of
speech. Everyday words that are two at once (run, play, fish, light, fast...)
only appear inside sentences, where the sentence decides. The tests fail if any
word lands in two lists.

### Shared with Word Kick

Word Kick (`../wordkick/`) imports the word lists, sentences, spelling and
question builders from this folder. Anything changed in `js/data.js` or the
question part of `js/engine.js` changes both games, so run both test suites
after editing.

## Prizes

Every 3 wins earns a prize, in a fixed order: a boxer card, then gear, then
a playable boxer, then round again (24 in all). Only wins at the boxer's own
grade or higher count, and losses never take progress away. The hub shows a
Prize Room bar with a 3-dot meter.

- **Boxer cards** (8): made-up boxers for the card album.
- **Gear** (8): golden, flame or galaxy gloves, neon or gold ring ropes, and
  knockout celebrations (victory dance, glove spin, flex). One per slot.
- **Playable boxers** (8): pick one and they box for you, with their own
  gloves and headwear.

The counting rules are in `js/rewards.js` (Word Kick uses the same file) and
the prize list is in `js/prizes.js`.

## Learning from misses

Every miss is logged against the specific word or sentence. Missed items come
back more often in later fights (a word missed once turns up about seven times
as often) and drift back to normal after the kid gets them right.

**Coach's Corner** shows accuracy per skill (nouns, verbs, adjectives, adverbs,
pronouns, spelling), belts won, and the most recent misses with their answers.
It also holds the settings:

- **Punch clock** on or off, for kids who freeze under time pressure.
- **Read questions out loud**, using the device's built-in voice. On by default
  for 1st and 2nd grade boxers. Spelling questions read the word and the
  sentence, never the choices. There is also a speaker button on every question.
- Sound effects, starting grade, and deleting a boxer.

## Running it

```
cd wordpunch
python3 -m http.server 8125
# then visit http://127.0.0.1:8125/
```

It will not run from `file://` because it uses ES modules. On GitHub Pages it
installs to a phone or tablet home screen and works offline after the first
load. Progress lives in that browser's `localStorage`, so a different browser
or device is a different set of boxers.

## Tests

```
./test/run.sh
```

- `test/engine.test.mjs`: every word list, sentence and spelling line parses
  and is consistent; thousands of generated questions each have exactly one
  right answer (tap questions can have several) and a real explanation; the
  fight rules (stars, power punch, get-ups, TKO); belts and ladder progress;
  saves from older versions and junk data load safely.
- `test/play.test.mjs`: plays in Chromium. Makes a boxer, wins, loses on
  purpose, wins the Minor Circuit belt, reloads, checks another grade and a
  second boxer, runs the clock out, and checks the hit animation lands on the
  fighter.

## Files

| file | what it holds |
| --- | --- |
| `js/data.js` | fighters, circuits, word lists, tagged sentences, spelling |
| `js/engine.js` | question building, fight rules, profile bookkeeping |
| `js/main.js` | every screen and the fight loop |
| `js/art.js` | fighters, player and belts as inline SVG |
| `js/storage.js` | boxers in localStorage |
| `js/sfx.js` | WebAudio sounds and read-aloud |

Bump `VERSION` in `js/data.js` and `CACHE` in `sw.js` together when shipping.
