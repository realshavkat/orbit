// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, copyFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const devDir = join(root, ".dev");
const runtime = join(devDir, "runtime");
const profile = join(devDir, "profile");
const srcUiDir = join(root, "src/browser/base/content/orbit");
const uiDir = join(runtime, "browser/orbit");
const args = process.argv.slice(2);

const gecko = process.env.ORBIT_GECKO || "C:/Program Files/Mozilla Firefox";

if (!existsSync(join(runtime, "firefox.exe"))) {
  if (!existsSync(join(gecko, "firefox.exe"))) {
    console.error(`No Gecko runtime found at ${gecko}. Set ORBIT_GECKO.`);
    process.exit(1);
  }
  console.log(`Copying Gecko runtime from ${gecko} ...`);
  mkdirSync(devDir, { recursive: true });
  cpSync(gecko, runtime, { recursive: true });
}
if (args.includes("--reset")) rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
rmSync(uiDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
cpSync(srcUiDir, uiDir, { recursive: true });
mkdirSync(profile, { recursive: true });

writeFileSync(
  join(runtime, "defaults/pref/autoconfig.js"),
  `pref("general.config.filename", "orbit-dev.cfg");
pref("general.config.obscure_value", 0);
pref("general.config.sandbox_enabled", false);
`
);
mkdirSync(join(runtime, "browser/defaults/preferences"), { recursive: true });
copyFileSync(join(root, "src/browser/app/profile/orbit.js"), join(runtime, "browser/defaults/preferences/orbit-prefs.js"));
writeFileSync(join(runtime, "browser/defaults/preferences/orbit-dev.js"), 'pref("marionette.port", 2829);\n');
rmSync(join(runtime, "defaults/pref/orbit-prefs.js"), { force: true });
writeFileSync(
  join(devDir, "orbit.manifest"),
  `content orbit ${pathToFileURL(uiDir).href}/\n` +
    ["concerned", "confetti", "happy", "holding-lock", "in-circle", "sympathetic"]
      .map(k => `override chrome://global/skin/illustrations/kit-${k}.svg chrome://orbit/content/illustration.svg\n`)
      .join("")
);
writeFileSync(
  join(runtime, "orbit-dev.cfg"),
  `// Orbit dev bootstrap (first line must be a comment)
try {
  const { manager: cm } = Components;
  const f = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  f.initWithPath(${JSON.stringify(join(devDir, "orbit.manifest"))});
  cm.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(f);
  // resource:// substitutions reach content processes (actor child modules).
  Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler)
    .setSubstitution("orbit", Services.io.newURI(${JSON.stringify(pathToFileURL(uiDir).href + "/")}));
  Services.obs.addObserver(win => {
    win.addEventListener("DOMContentLoaded", e => {
      const doc = e.target;
      if (doc.location?.href != "chrome://browser/content/browser.xhtml") return;
      for (const href of ["chrome://orbit/content/orbit.css"]) {
        const l = doc.createElementNS("http://www.w3.org/1999/xhtml", "link");
        l.rel = "stylesheet"; l.href = href; doc.head.append(l);
      }
      const ce = doc.defaultView.customElements;
      ce.whenDefined("tabbrowser-tabs").then(() => {
        const proto = ce.get("tabbrowser-tabs").prototype;
        const d = Object.getOwnPropertyDescriptor(proto, "allTabs");
        Object.defineProperty(proto, "allTabs", { get() { return d.get.call(this).filter(t => t.tagName == "tab"); } });
      });
      Services.scriptloader.loadSubScript("chrome://orbit/content/orbit.js", doc.defaultView);
    });
  }, "chrome-document-global-created");
} catch (e) { Components.utils.reportError(e); }
`
);

const ini = join(runtime, "browser/application.ini");
writeFileSync(
  ini,
  readFileSync(join(runtime, "application.ini"), "utf8")
    .replace(/^Vendor=.*$/m, "Vendor=OrbitDev")
    .replace(/^Name=.*$/m, "Name=OrbitDev")
    .replace(/^RemotingName=.*$/m, "RemotingName=orbit-dev")
);

const ffArgs = ["-app", ini, "-profile", profile, "-no-remote", "-purgecaches"];
if (args.includes("--marionette")) ffArgs.push("--marionette", "-remote-allow-system-access");
console.log("Launching Orbit (dev)...");
spawn(join(runtime, "firefox.exe"), ffArgs, { stdio: "inherit", detached: !args.includes("--wait") }).unref();
