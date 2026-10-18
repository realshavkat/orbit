// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Prepares a release after `npm run package`:
//   - dist/output.mar          -> dist/release/windows.mar
//   - dist/orbit.installer.exe -> dist/release/Orbit-Setup-<version>.exe
//   - dist/update/browser/**   -> updates/browser/** (served from the repo,
//     this is what installed copies poll for auto-updates)
// With --publish it also creates the GitHub release via `gh`.
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const cfg = JSON.parse(readFileSync(join(root, "surfer.json"), "utf8"));
const { displayVersion: version, github } = cfg.brands.release.release;
const dist = join(root, "dist");
const out = join(dist, "release");

const need = ["output.mar", "orbit.installer.exe", "update"];
for (const f of need) {
  if (!existsSync(join(dist, f))) {
    console.error(`Missing dist/${f}. Run \`npm run build\` then \`npm run package\` first.`);
    process.exit(1);
  }
}
mkdirSync(out, { recursive: true });
cpSync(join(dist, "output.mar"), join(out, "windows.mar"));
const installer = `Orbit-Setup-${version}.exe`;
cpSync(join(dist, "orbit.installer.exe"), join(out, installer));
cpSync(join(dist, "update/browser"), join(root, "updates/browser"), { recursive: true });
console.log(`Release ${version} ready in dist/release, update manifest copied to updates/browser/.`);

// Patch notes shown in Orbit's update window: notes/<version>.md (Markdown).
const notesFile = join(root, "notes", `${version}.md`);
const notesArgs = existsSync(notesFile) ? ["--notes-file", notesFile] : ["--notes", `Orbit ${version}`];
if (process.argv.includes("--publish")) {
  execFileSync("gh", ["release", "create", version, join(out, "windows.mar"), join(out, installer),
    "--repo", github.repo, "--title", `Orbit ${version}`, ...notesArgs], { stdio: "inherit" });
  console.log("Now commit and push updates/browser/ so installed browsers see the update.");
} else {
  console.log("Next: `node tools/release.mjs --publish`, then commit + push updates/browser/.");
}
