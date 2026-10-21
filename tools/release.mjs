// This Source Code Form is subject to the terms of the Mozilla Public

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
  const notesFile = join(root, "notes", `${version}.md`);
  const notesArgs = existsSync(notesFile) ? ["--notes-file", notesFile] : ["--notes", `Orbit ${version}`];
  execFileSync("gh", ["release", "create", version, mar, installer,
    "--repo", github.repo, "--title", `Orbit ${version}`, ...notesArgs], { stdio: "inherit" });
  cpSync(join(dist, "update/browser"), join(root, "updates/browser"), { recursive: true });
  console.log("Release created. Now commit and push updates/browser/ so installed copies see it.");
} else {
  console.log(`Ready: ${installer}, ${mar}. Publish with \`node tools/release.mjs --publish\`.`);
}
