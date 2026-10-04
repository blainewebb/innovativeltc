# Knight School

A chess trainer for kids. Puzzle books, short lessons from the Coach, and
games against the Coach at different levels.

Static site, no build step, no accounts. Progress (stars, solved puzzles,
players) is saved in the browser on the device. Installs to a phone or tablet
home screen.

## What's in it

- **Puzzle books:** puzzles from *Winning Chess Strategy for Kids* (Jeff
  Coakley), *The Chess Course* (Praful Zaveri), *Bobby Fischer Teaches Chess*
  and *Chess Openings: Traps and Zaps* (Bruce Pandolfini), in `books/`.
  Solutions were worked out or checked with Stockfish. The Coach names the trick (fork, pin, back-rank
  mate...) and gives hints.
- **Lessons:** ten short lessons (piece values, check, forks, pins, skewers,
  promotion and more), each with one practice move. In `lessons.js`.
- **Play the Coach:** play a full game at beginner to strong levels.
  Beginner levels use a small built-in engine. Stronger levels use
  Stockfish 10 from `vendor/` (cdnjs as a fallback); if neither loads, the
  built-in engine takes over.
- Several players can share one device. The Coach can read out loud.
- **Backup:** the Backup button gives a code with every player's progress.
  Paste it on another device to move progress over.

## Files

- `index.html` page and styles
- `app.js` screens, players, progress
- `board.js` the board (tap or drag to move)
- `coach.js` chess helpers, theme finder, engines
- `lessons.js` lesson text and practice positions
- `books/*.js` puzzle data
- `vendor/` chess.js 0.10.3 and Stockfish 10 (GPLv3), bundled so the game
  doesn't depend on a CDN

## Offline

`sw.js` caches the page, game scripts, books, icons, the bundled chess.js and
Stockfish, and the Google Fonts stylesheet on the first visit.

Bump `CACHE` in `sw.js` when changing the files it caches.
