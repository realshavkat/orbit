// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Lists every English UI string of Orbit (Orbit.tr() calls and the English
// side of the {fr, en} tables) and reports, per language file in
// orbit/locales/, which ones are missing.
//   node tools/i18n_extract.mjs            -> summary
//   node tools/i18n_extract.mjs --missing es -> JSON of strings to translate
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import vm from "node:vm";

const dir = resolve(import.meta.dirname, "../src/browser/base/content/orbit");
const strings = new Set();

// 1. Orbit.tr("English", ...) (or its local aliases T and tr) with a plain string literal.
const TR = /(?:Orbit\.tr|\bT|\btr)\(\s*"((?:[^"\\]|\\.)*)"/g;
for (const f of readdirSync(dir).filter(f => f.endsWith(".js"))) {
  for (const m of readFileSync(join(dir, f), "utf8").matchAll(TR)) strings.add(JSON.parse(`"${m[1]}"`));
}

// 2. The English side of the tables, read by running the files in a sandbox
//    where every unknown global is a harmless stand-in.
const stub = new Proxy(function () {}, { get: (t, k) => (k == Symbol.toPrimitive ? () => "" : stub), apply: () => stub, construct: () => stub });
const ctx = vm.createContext(new Proxy({ console }, { has: () => true, get: (t, k) => (k in t ? t[k] : k in globalThis ? globalThis[k] : stub) }));
const tables = [["orbit.js", "ORBIT_STRINGS"], ["orbit-settings.js", "OrbitSettings.STRINGS"], ["orbit-notify.js", "OrbitNotify.S"]];
const add = v => (typeof v == "string" ? strings.add(v) : Array.isArray(v) ? v.forEach(add) : null);
for (const [file, expr] of tables) {
  const src = readFileSync(join(dir, file), "utf8").replace(/^if \(document\.readyState[\s\S]*$/m, "");
  vm.runInContext(`${src}\n;globalThis.__t = ${expr};`, ctx);
  Object.values(ctx.__t.en).forEach(add);
}
for (const file of ["orbit-menu.js", "orbit-settings.js"]) {
  const src = readFileSync(join(dir, file), "utf8");
  for (const m of src.matchAll(/en: "((?:[^"\\]|\\.)*)"/g)) strings.add(JSON.parse(`"${m[1]}"`));
  for (const m of src.matchAll(/\["[^"]*", "(?:[^"\\]|\\.)*", "((?:[^"\\]|\\.)*)"\]/g)) strings.add(JSON.parse(`"${m[1]}"`));
}
for (const s of [...strings]) if (!s.trim() || !/[A-Za-z]/.test(s)) strings.delete(s);

const locales = join(dir, "locales");
const lang = process.argv[process.argv.indexOf("--missing") + 1];
const load = l => {
  const file = join(locales, `${l}.js`);
  if (!existsSync(file)) return {};
  const sandbox = { ORBIT_I18N: {} };
  vm.runInNewContext(readFileSync(file, "utf8"), sandbox);
  return sandbox.ORBIT_I18N[l] ?? {};
};
if (process.argv.includes("--missing")) {
  const have = load(lang);
  console.log(JSON.stringify([...strings].filter(s => !(s in have)).sort(), null, 1));
} else {
  console.log(`${strings.size} strings`);
  if (existsSync(locales)) {
    for (const f of readdirSync(locales).filter(f => f.endsWith(".js"))) {
      const l = f.slice(0, -3);
      const have = load(l);
      console.log(`${l}: ${[...strings].filter(s => s in have).length}/${strings.size}`);
    }
  }
}
