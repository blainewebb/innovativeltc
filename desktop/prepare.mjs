// Copies the single source-of-truth quoting page into the Tauri frontend dir.
// Runs automatically before each build (tauri.conf.json -> build.beforeBuildCommand).
// Keeping one copy of ltc-quote.html at the repo root avoids the desktop build
// ever drifting from the web/Artifact version.
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)); // .../desktop
const src = resolve(here, "..", "ltc-quote.html");     // repo-root/ltc-quote.html
const outDir = resolve(here, "dist");
const out = resolve(outDir, "index.html");

if (!existsSync(src)) {
  console.error("prepare.mjs: cannot find " + src);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
copyFileSync(src, out);
console.log("prepare.mjs: copied ltc-quote.html -> desktop/dist/index.html");
