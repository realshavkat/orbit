// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Prepares a release after `tools/package.sh`:
//   - dist/update/browser/** -> updates/browser/** (served from the repo:
//     installed copies poll it for auto-updates once it is pushed)
// With --publish it also creates the GitHub release <version> with the
// signed MAR and the installer (via `gh`). Publishing reaches every
// installed copy: only do it on purpose.
import { cpSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const cfg = JSON.parse(readFileSync(join(root, "surfer.json"), "utf8"));
const { displayVersion: version, github } = cfg.brands.release.release;
const dist = join(root, "dist");
const installer = join(dist, `Orbit-Setup-${version}.exe`);
const mar = join(dist, "windows.mar");

for (const f of [installer, mar, join(dist, "update/browser")]) {
  if (!existsSync(f)) {
    console.error(`Missing ${f}. Run \`tools\\mozbuild.cmd sh tools/package.sh\` first.`);
    process.exit(1);
  }
}

if (process.argv.includes("--publish")) {
  // Patch notes shown in Orbit's update window: notes/<version>.md (Markdown).
  const notesFile = join(root, "notes", `${version}.md`);
  const notesArgs = existsSync(notesFile) ? ["--notes-file", notesFile] : ["--notes", `Orbit ${version}`];
  execFileSync("gh", ["release", "create", version, mar, installer,
    "--repo", github.repo, "--title", `Orbit ${version}`, ...notesArgs], { stdio: "inherit" });
  // Only now point installed copies at it.
  cpSync(join(dist, "update/browser"), join(root, "updates/browser"), { recursive: true });
  console.log("Release created. Now commit and push updates/browser/ so installed copies see it.");
} else {
  console.log(`Ready: ${installer}, ${mar}. Publish with \`node tools/release.mjs --publish\`.`);
}
