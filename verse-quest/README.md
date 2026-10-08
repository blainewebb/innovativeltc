# Verse Quest

A Bible memory game for kids, built like a language-learning app: a few
minutes a day, short steps, a daily goal and a streak. It also has quick Bible
trivia rounds. Made for 8 and 9 year olds playing on their own on a phone,
tablet or computer.

One page (`index.html`), no build step, no accounts, nothing sent anywhere.
Works offline once loaded and installs to a phone or tablet home screen. Up to
3 kids can share one device, each with their own player.

## Players and the grown-ups screen

Kids pick who's playing on the first screen. They can't add, rename or delete
players. **Grown-ups** (on the first screen and the home screen) sits behind a
times-table question (6 to 12 times 6 to 12), the same idea as Mundo
Criatura's. It's a speed bump, not a real lock: a kid who knows their 12s
can get in.

Behind it:

- **Players:** 3 spots. Add, rename, or delete (with an on-screen "are you
  sure?"). Deleting the player who was playing sends the game back to
  "Who's playing?".
- **Progress for each player:** verses memorized, gold verses, verses in
  progress, reviews due, streak, trivia accuracy, and trivia they keep
  missing.
- **Settings for each player:** sound, read-aloud, and the daily goal.

## How a verse is learned

Each verse takes 5 steps. Each step is a lesson of one or two exercises that
hides a bit more of the verse than the last:

| step | exercises |
| --- | --- |
| 1 | Read it out loud (or have it read to you), then fill in a few missing words |
| 2 | Fill in more missing words, then match the verse to its reference |
| 3 | Put phrase tiles in order, then fill in most of the words |
| 4 | Pick each next word with only first letters showing, then the reference again |
| 5 | Pick each next word from memory, nothing showing |

- **At most 2 steps per verse per day.** A verse takes at least 3 days. That
  is on purpose: spreading practice over days sticks much better than
  cramming (the "spacing effect"; Cepeda et al., 2006, *Psychological
  Bulletin*).
- **At most 2 verses in progress at once**, so kids finish what they start.
- **Mistakes:** a lesson passes with up to 2 wrong taps, plus 1 more for every
  10 words in the verse. Fail and you just try that step again. Capital
  letters and punctuation never count against you.
- **Choosing verses:** the home screen offers the next verse on the list. In
  **My verses** a kid can start any verse instead, when a slot is free.

## Reviews

Once a verse is memorized it comes back for a quick review after 1, 3, 7, 14,
30, then every 60 days. Reviews show up first on the home screen. Passing
pushes it further out. Missing one moves it back two levels (not to the start)
and brings it back the next day. After four passed reviews (about 3 to 4
weeks) the verse turns **gold**.

Any memorized verse can also be practiced from **My verses**. Practice counts
toward the daily goal but does not change the review schedule.

## Daily goal and streak

- One **activity** is a lesson step, a review, a practice, or a trivia round.
- The daily goal is 3 activities (a grown-up can change it to 2 or 5).
- Meeting the goal adds a day to the streak.
- **Streak savers:** every 7 days of streak earns one (up to 2). If a kid
  misses exactly one day, a saver is used automatically and the streak stays.
  This is there so one missed day doesn't make a kid give up on a long streak.

Stars and badges are just for fun. Nothing real is attached to them on
purpose: paying kids with prizes for something they already enjoy can make
them like it less once the prizes stop (the "overjustification effect";
Lepper, Greene & Nisbett, 1973).

## Trivia

Rounds of 5 multiple-choice or true/false questions from four groups: Old
Testament, Jesus, Church and Letters, and Bible Basics. After every answer it
shows the right answer, a one-line explanation and where to find it in the
Bible. Questions a kid has never seen or keeps missing come up most. Ones
answered right several times show up less.

The grown-ups screen lists the trivia questions each kid keeps missing, as
something to talk about together.

## The verses

40 passages (45 verses in all), NIV 2011 text. No single
official list exists. These were picked because they show up again and again
on kids' memory verse lists from churches and kids' ministries: Genesis 1:1,
John 3:16, Psalm 23:1, Proverbs 3:5-6, Joshua 1:9, Philippians 4:13, the
fruit of the Spirit, and so on. They run from short to long.

**Check the wording before relying on it.** The text was written in by hand.
A sample was checked against Bible.com and similar sites (Psalm 119:105,
Proverbs 3:5-6, 2 Corinthians 5:17, Micah 6:8, Deuteronomy 31:6, Psalm 136:1,
Jeremiah 29:11, Galatians 5:22-23, Psalm 23:1), but not every verse. Kids will
memorize exactly what the game shows, so it is worth comparing each one to
your own NIV Bible or [BibleGateway](https://www.biblegateway.com/) once. To
fix or add a verse, edit `VERSES` in `index.html`.

### NIV permission

Biblica's NIV policy lets you quote up to 500 verses in any form without
written permission, as long as they are not a complete book of the Bible and
are not 25% or more of the whole work, and the copyright notice is shown. The
notice is on the first screen and on the grown-ups screen. Check the current
policy at [biblica.com/permissions](https://www.biblica.com/permissions/)
before sharing this outside the family, because in a verse game the verses
are most of the text, and the 25% rule may matter if it is ever published
widely or sold.

## Trivia content

All trivia in `index.html` (`TRIVIA`) is hand-written, each with a Bible reference except
a few general questions. Read through it once. "How many books are in the
Bible?" says 66 and notes that Catholic Bibles have more.

## Installing it

Once merged it's served at `/verse-quest/` on the repo's GitHub Pages site.
Open that address on the phone or tablet, then:

- **iPhone or iPad (Safari):** Share button, then **Add to Home Screen**.
- **Android (Chrome):** menu, then **Install app** or **Add to Home screen**.

It works offline after the first load. Progress lives in that browser's
storage on that device, so a different browser or device starts fresh, and
clearing the browser's site data erases it.

## Running it locally

```
cd verse-quest
python3 -m http.server 8126
# then visit http://localhost:8126/
```

## Tests

```
./test/run.sh
```

- `test/engine.test.mjs` loads the rules straight out of `index.html` (the
  part between the `@engine-begin` and `@engine-end` markers, which has no
  page code). It checks that every verse splits into words and rebuilds
  exactly, that thousands of generated exercises each have exactly one right
  answer per step, that trivia answers are distinct, the 5-step schedule, the
  2-per-day limit, review timing, gold verses, streaks and savers, that missed
  trivia comes back more, the 3-player cap, and that old or junk saves load
  safely.
- `test/play.test.mjs` plays in Chromium at phone size (390 by 844). A
  grown-up gets through the gate (a wrong answer first), adds a player, and a
  kid learns Genesis 1:1 over three pretend days. Along the way it fails a
  step on purpose, plays a perfect trivia round, reloads, passes a review,
  and practices. Then the grown-up fills all 3 spots, renames one, changes
  the daily goal and deletes a player. It also checks the game still opens
  with the network off, and that nothing scrolls sideways.

## Files

| file | what it holds |
| --- | --- |
| `index.html` | the whole game: content, rules, saving, sounds, screens, styles |
| `sw.js` | offline support |
| `manifest.webmanifest` | name, colors and icons for installing |
| `icon-192.png`, `icon-512.png` | app icons |
| `icon-512-maskable.png` | Android icon with room for round and squircle masks |
| `apple-touch-icon.png` | iPhone and iPad home screen icon |

Bump `VERSION` in `index.html` and `CACHE` in `sw.js` together when shipping.
