// This Source Code Form is subject to the terms of the Mozilla Public

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const { brands } = JSON.parse(readFileSync(join(root, "surfer.json"), "utf8"));
const repo = `https://github.com/${brands.release.release.github.repo}`;
const branding = join(root, "engine/browser/branding/release");

const fix = (file, pairs) => {
  let s = readFileSync(file, "utf8");
  for (const [from, to] of pairs) s = s.replace(from, to);
  writeFileSync(file, s);
};

fix(join(branding, "pref/firefox-branding.js"), [
  [/https:\/\/zen-browser\.app\/whatsnew\?v=%VERSION%/, ""],
  [/https:\/\/zen-browser\.app\/welcome\//, ""],
  [/https:\/\/zen-browser\.app\/privacy-policy\//, ""],
  [/https:\/\/zen-browser\.app\/download\//, `${repo}/releases/latest`],
  [/https:\/\/zen-browser\.app\/release-notes\/latest\//, `${repo}/releases/latest`],
  [/https:\/\/zen-browser\.app\/whatsnew\//, `${repo}/releases`],
  [/https:\/\/www\.zen-browser\.app\/release-notes\/%VERSION%\//, `${repo}/releases/tag/%VERSION%`],
  [/https:\/\/zen-browser\.app\/release-notes\/%VERSION%\//, `${repo}/releases/tag/%VERSION%`],
]);
fix(join(branding, "branding.nsi"), [
  [/"https:\/\/zen-browser\.app"/, `"${repo}"`],
  [/https:\/\/zen-browser\.app\/release-notes\/\$\{AppVersion\}/, `${repo}/releases`],
  [/https:\/\/github\.com\/zen-browser\/desktop\/issues/, `${repo}/issues`],
  [/https:\/\/zen-browser\.app\/download/, `${repo}/releases/latest`],
]);

const left = [join(branding, "pref/firefox-branding.js"), join(branding, "branding.nsi")]
  .filter(f => /zen-browser/.test(readFileSync(f, "utf8")));
if (left.length) {
  console.error("Zen URLs still present in:", left);
  process.exit(1);
}
console.log("Branding URLs point to", repo);
