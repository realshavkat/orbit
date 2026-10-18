// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Fast UI loop: runs Orbit's chrome code (src/browser/base/content/orbit)
// live on top of an existing Gecko runtime, without compiling Firefox.
// Edit a file, restart with `npm run dev`, done. The real build bakes the
// same files in through jar.mn + browser.xhtml patches.
//
//   npm run dev                 launch
//   npm run dev -- --marionette launch with Marionette on port 2828 (tools/mn.mjs)
//   npm run dev -- --reset      wipe the dev profile first

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, copyFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const devDir = join(root, ".dev");
const runtime = join(devDir, "runtime");
const profile = join(devDir, "profile");
const srcUiDir = join(root, "src/browser/base/content/orbit");
// Copied into the install dir: sandboxed content processes can read it there
// (Glance's actor child module is loaded in web content processes).
const uiDir = join(runtime, "browser/orbit");
const args = process.argv.slice(2);

// shortcut: dev runtime is copied from the local Firefox install; point
// ORBIT_GECKO at another Gecko build (e.g. engine/obj-*/dist/bin) to change it.
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

// Autoconfig bootstrap: registers chrome://orbit/content/ -> src folder and
// injects the same <link>/<script> tags the browser.xhtml patch adds.
writeFileSync(
  join(runtime, "defaults/pref/autoconfig.js"),
  `pref("general.config.filename", "orbit-dev.cfg");
pref("general.config.obscure_value", 0);
pref("general.config.sandbox_enabled", false);
`
);
// App-level defaults load after firefox.js, like the #include in the real build.
mkdirSync(join(runtime, "browser/defaults/preferences"), { recursive: true });
copyFileSync(join(root, "src/browser/app/profile/orbit.js"), join(runtime, "browser/defaults/preferences/orbit-prefs.js"));
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
      Services.scriptloader.loadSubScript("chrome://orbit/content/orbit.js", doc.defaultView);
    });
  }, "chrome-document-global-created");
} catch (e) { Components.utils.reportError(e); }
`
);

// -app gives the dev build its own identity (profile root, remoting name).
// The ini must sit in browser/ so resource:/// still resolves to the app dir.
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
