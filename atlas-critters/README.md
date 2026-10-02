# Atlas Critters

A creature-catching geography game for kids. Answer map, capital, biggest-city
and fun-fact questions to battle wild creatures, catch them, level them up, and
watch them evolve. Every creature is named after something in nature (Cinder,
Glacier, Monsoon...).

Static site, no build step, no accounts. Progress is saved in the browser on
the device. Works offline after the first visit and installs to a phone or
tablet home screen. Up to three kids can share one device with separate
players.

## How it plays

- Pick a zone, meet a wild creature, answer questions. New facts are shown
  first, then asked. Right answers hit the creature; wrong answers cost a heart
  and show the right answer.
- Map questions: "which state is lit up?" and "tap Kansas on the map."
- The device's built-in voice can read questions and facts (slow by default).
- Partner creatures evolve at level 5 and level 10.
- Catch 3 creatures in a zone to unlock its boss and medal.

## Zones

United States: Northeast, Southeast Coast, Deep South, Great Lakes, Great
Plains, Southwest, Rocky Mountains, Pacific.

The world: North America, South America, Western Europe, Northern and Eastern
Europe, Africa, East and South Asia, Middle East and Central Asia, Oceania.

A zone opens once half of the previous zone's facts are learned (learned =
right 2 times in a row). A grown-up can open every zone from the parent screen.

## Players and grown-ups

Kids pick who's playing on the first screen. They can't add, rename or delete
players. **Players (grown-ups)** and **Parents** sit behind a times-table
question (6 to 12 times 6 to 12), the same as Mundo Criatura and Verse Quest.
It's a speed bump, not a real lock.

- **Players:** 3 spots. Add (name, color, first creature), rename, or delete
  with an on-screen "are you sure?".
- **Parent screen:** minutes this week, facts learned, accuracy, medals,
  facts that need practice, progress by zone, recent days, and the "open
  every zone" switch.

## Offline

`sw.js` caches the page, icons, the two map libraries (d3 and topojson from
cdnjs) and the Google Fonts stylesheet on the first visit. The map outlines
(US states and world countries, from us-atlas and world-atlas / Natural Earth)
are built into `index.html`. If the map libraries can't load, map questions
turn off and the rest of the game still works.

Bump `CACHE` in `sw.js` when changing the files it caches.
