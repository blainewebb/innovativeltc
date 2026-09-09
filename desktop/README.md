# Innovative LTC — desktop app

This wraps the single-file quoting page (`ltc-quote.html` at the repo root) in a
real desktop app using [Tauri](https://tauri.app). The result is a normal
Windows installer (`.msi` / `.exe`) and a macOS installer (`.dmg`) with its own
icon, its own window, and its own saved data — no browser needed, works offline.

The web/Artifact version and the desktop app share the **same** `ltc-quote.html`,
so they never drift: every build copies that one file in.

---

## Easiest way to get installers — let GitHub build them (no tools on your computer)

Windows installers must be built on Windows and Mac installers on a Mac, so we
let GitHub's servers build both for you.

1. Go to the repository on **GitHub → the "Actions" tab**.
2. Pick **"Build desktop app"** in the left list, then click **"Run workflow"**
   (top right) → **Run workflow**.
3. Wait ~10–15 minutes. When it finishes, open the run and download the
   **installers-windows-latest** and **installers-macos-latest** files from the
   "Artifacts" section at the bottom.

### To make a versioned public download (a "Release")

From your computer, in the project folder:

```bash
git tag v1.0.0
git push origin v1.0.0
```

That kicks off the same build and, when done, creates a **GitHub Release** with
the Windows and macOS installers attached, ready to hand to other agents. Bump
the number (`v1.0.1`, `v1.1.0`, …) for each new release, and keep the version in
`desktop/src-tauri/tauri.conf.json` in step.

---

## Installing the app

- **Windows:** run the `.msi` (or the `.exe`). Windows SmartScreen may warn that
  the publisher is unknown (the app isn't code-signed) — click **More info → Run
  anyway**. Signing removes the warning but needs a paid certificate; ask me and
  I'll wire it in.
- **macOS:** open the `.dmg` and drag **Innovative LTC** to Applications. The
  first launch, **right-click the app → Open** (again because it isn't signed),
  then **Open** in the dialog.

---

## Building it yourself (optional)

If you'd rather build on your own machine:

1. Install [Rust](https://www.rust-lang.org/tools/install) and
   [Node.js](https://nodejs.org).
2. On Windows also install the **Microsoft C++ Build Tools**; on macOS run
   `xcode-select --install`; on Linux install the WebKitGTK dev packages.
3. In a terminal:

   ```bash
   cd desktop
   npm install
   npm run build
   ```

The installer lands in `desktop/src-tauri/target/release/bundle/`.
Use `npm run dev` to open the app live while iterating.

---

## What's here

| File | Purpose |
|---|---|
| `prepare.mjs` | Copies `../ltc-quote.html` → `dist/index.html` before each build |
| `src-tauri/tauri.conf.json` | App name, window size, icons, bundle settings |
| `src-tauri/src/main.rs` | Minimal native shell that opens the page in a window |
| `src-tauri/icons/` | App icons (generated from `icon-512.png`) |
| `../.github/workflows/desktop-build.yml` | Builds Windows + macOS installers on GitHub |
