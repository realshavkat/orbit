// This Source Code Form is subject to the terms of the Mozilla Public

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [version, mar, platformIni] = process.argv.slice(2);
const root = resolve(import.meta.dirname, "..");
const { brands } = JSON.parse(readFileSync(join(root, "surfer.json"), "utf8"));
const repo = brands.release.release.github.repo;
const appIni = platformIni.replace(/platform\.ini$/, "application.ini");
const buildID = /BuildID=(\d+)/.exec(readFileSync(appIni, "utf8"))[1];
const milestone = /Milestone=([\w.]+)/.exec(readFileSync(platformIni, "utf8"))[1];
const bytes = readFileSync(mar);
const hash = createHash("sha512").update(bytes).digest("hex");
const url = `https://github.com/${repo}/releases/download/${version}/windows.mar`;
const notes = `https://github.com/${repo}/releases/tag/${version}`;

const xml = `<?xml version="1.0"?>
<updates>
  <update type="minor" displayVersion="${version}" appVersion="${version}" platformVersion="${milestone}" buildID="${buildID}" detailsURL="${notes}">
    <patch type="complete" URL="${url}" hashFunction="sha512" hashValue="${hash}" size="${statSync(mar).size}"/>
  </update>
</updates>
`;
for (const target of ["WINNT_x86_64-msvc", "WINNT_x86_64-msvc-x64"]) {
  const dir = join(root, "dist", "update", "browser", target, "release");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "update.xml"), xml);
}
console.log(`update.xml for ${version} (build ${buildID}), ${url}`);
