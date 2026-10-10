# Monster Truck Smash

A spoken preschool game: count the cars, add them up, find the letters and words, then crush them
with a monster truck. Stunt Time and the Big Race are the rewards. Works offline once it has been
opened one time.

## Install on a phone or iPad
1. Open the game link (this folder on the site) in Safari (iPhone/iPad) or Chrome (Android).
2. Tap Share, then **Add to Home Screen**.
3. Open it once from the home screen while online. After that it plays with no internet.

## Voice
Everything the game says is a recorded clip in the voice "Emma - Bright Kids Educator" (ElevenLabs),
the same voice as Word Punch and Word Kick. The clips are in `voice/` and listed in
`voice/manifest.json`. The first time the game opens online it saves all of them on the device
(about 5 MB), so the voice works offline after that.

A line with no clip (for example a kid's name that wasn't recorded) is read by the device voice
instead. Grown-up settings has a switch to use the device voice for everything.

Every spoken line comes from `content.js`. After changing a line or adding one (a new kid's name goes
in `NAMES`), record the missing clips:

```
node monster-truck/voice/make-voice.mjs --dry-run      # what's missing
ELEVENLABS_API_KEY=... node monster-truck/voice/make-voice.mjs
```

`make-voice.mjs` also explains how to record in batches without an API key, and `--prune` deletes
clips for lines no longer used. It needs ffmpeg.

## Updating
Change the files, then bump `VERSION` in `sw.js` so devices download the new copy. Voice clips don't
need a bump: new ones download on their own the next time the game opens online.

Fonts: Andika and Baloo 2 (SIL Open Font License).
