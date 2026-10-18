/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Chrome extensions. On a Chrome Web Store page Orbit offers "Add to Orbit":
// it downloads the extension (.crx) from Google, turns it into a Gecko
// add-on (manifest tweaks) and installs it. Extensions from addons.mozilla.org
// install as usual. Chrome extensions are not signed by Mozilla, so the user
// first allows unsigned extensions (a clear, one-time choice).
var OrbitChromeExt = {
  STORE: /^https:\/\/(?:chromewebstore\.google\.com\/detail\/(?:[^/]+\/)?|chrome\.google\.com\/webstore\/detail\/(?:[^/]+\/)?)([a-p]{32})/,
  CRX_URL: id => `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&acceptformat=crx2,crx3&x=id%3D${id}%26installsource%3Dondemand%26uc`,

  init() {
    const check = () => this.offer(gBrowser.currentURI?.spec ?? "");
    gBrowser.addProgressListener({
      onLocationChange: (webProgress, _req, _loc, flags) => webProgress.isTopLevel && check(),
      QueryInterface: ChromeUtils.generateQI(["nsIWebProgressListener", "nsISupportsWeakReference"]),
    });
    gBrowser.tabContainer.addEventListener("TabSelect", check);
  },

  get unsignedAllowed() {
    return !Orbit.pref("xpinstall.signatures.required", true);
  },

  // A toast with "Add to Orbit" while a store page is shown.
  offer(url) {
    const id = this.STORE.exec(url)?.[1];
    document.getElementById("orbit-chrome-offer")?.remove();
    if (!id) return;
    const h = Orbit.h.bind(Orbit);
    let stack = document.getElementById("orbit-toasts");
    if (!stack) document.body.append(stack = h("div", { id: "orbit-toasts" }));
    const btn = h("button", { class: "orbit-toast-b1", onclick: () => this.install(id, btn) }, Orbit.tr("Add to Orbit", "Ajouter à Orbit"));
    stack.append(h("div", { id: "orbit-chrome-offer", class: "orbit-toast", role: "status" },
      h("div", { class: "orbit-toast-main" },
        h("span", { class: "orbit-toast-icon" }, Orbit.icon("puzzle")),
        h("div", { class: "orbit-toast-text" },
          h("b", {}, Orbit.tr("Chrome extension", "Extension Chrome")),
          h("span", {}, Orbit.tr("Orbit can install it: most Chrome extensions work in Orbit.",
            "Orbit peut l'installer : la plupart des extensions Chrome fonctionnent dans Orbit."))),
        h("button", { class: "orbit-toast-close", "aria-label": Orbit.tr("Close", "Fermer"),
          onclick: () => document.getElementById("orbit-chrome-offer")?.remove() }, Orbit.icon("x"))),
      h("div", { class: "orbit-toast-actions" }, btn)));
  },

  // Unsigned extensions are a security trade-off: ask once, clearly.
  allowUnsigned() {
    if (this.unsignedAllowed) return true;
    const ok = Services.prompt.confirm(window, "Orbit", Orbit.tr(
      "Chrome extensions are not checked by Mozilla. Allow extensions that are not signed? Only install ones you trust. You can turn this off in Settings › Privacy.",
      "Les extensions Chrome ne sont pas vérifiées par Mozilla. Autoriser les extensions non signées ? N'installe que celles en qui tu as confiance. Tu peux revenir en arrière dans Paramètres › Vie privée."));
    if (ok) Services.prefs.setBoolPref("xpinstall.signatures.required", false);
    return ok;
  },

  async install(id, btn) {
    if (!this.allowUnsigned()) return;
    const label = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = Orbit.tr("Installing…", "Installation…");
    }
    try {
      const res = await fetch(this.CRX_URL(id), { credentials: "omit" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xpi = await this.toXpi(new Uint8Array(await res.arrayBuffer()), id);
      await this.installFile(xpi);
      document.getElementById("orbit-chrome-offer")?.remove();
    } catch (e) {
      console.error("Orbit: Chrome extension", e);
      if (btn) {
        btn.disabled = false;
        btn.textContent = label;
      }
      OrbitNotify.show({ kind: "chrome-ext", icon: "puzzle", tone: "warm", title: Orbit.tr("Chrome extension", "Extension Chrome"),
        text: Orbit.tr("This extension could not be installed.", "Cette extension n'a pas pu être installée."), timeout: 5000 });
    }
  },

  // Offset of the zip archive inside a .crx (v2 or v3).
  zipOffset(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = String.fromCharCode(...bytes.subarray(0, 4));
    if (magic == "PK\x03\x04") return 0; // already a zip
    if (magic != "Cr24") throw new Error("not a crx");
    const version = view.getUint32(4, true);
    if (version == 3) return 12 + view.getUint32(8, true);
    if (version == 2) return 16 + view.getUint32(8, true) + view.getUint32(12, true);
    throw new Error(`crx v${version}`);
  },

  // Chrome manifest -> Gecko manifest.
  adaptManifest(manifest, id) {
    manifest.browser_specific_settings ??= {};
    manifest.browser_specific_settings.gecko ??= {};
    manifest.browser_specific_settings.gecko.id ??= `${id}@chrome-web-store`;
    delete manifest.update_url;
    delete manifest.key;
    // Gecko runs MV3 backgrounds as event pages (scripts), not service workers.
    const sw = manifest.background?.service_worker;
    if (sw) {
      manifest.background.scripts = [sw];
      if (manifest.background.type != "module") delete manifest.background.type;
    }
    return manifest;
  },

  // Writes an installable .xpi into the profile's temp folder.
  async toXpi(crx, id) {
    const dir = PathUtils.join(PathUtils.tempDir, "orbit-chrome-ext");
    await IOUtils.makeDirectory(dir, { ignoreExisting: true });
    const zipPath = PathUtils.join(dir, `${id}.zip`);
    const xpiPath = PathUtils.join(dir, `${id}.xpi`);
    await IOUtils.write(zipPath, crx.subarray(this.zipOffset(crx)));
    const reader = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
    const writer = Cc["@mozilla.org/zipwriter;1"].createInstance(Ci.nsIZipWriter);
    reader.open(new FileUtils.File(zipPath));
    try {
      await IOUtils.remove(xpiPath, { ignoreAbsent: true });
      writer.open(new FileUtils.File(xpiPath), 0x04 | 0x08 | 0x20); // RDWR | CREATE | TRUNCATE
      for (const entry of reader.findEntries(null)) {
        if (entry.endsWith("/") || entry.startsWith("_metadata/")) continue;
        if (entry == "manifest.json") {
          const raw = new TextDecoder().decode(NetUtil.readInputStream(reader.getInputStream(entry), reader.getEntry(entry).realSize));
          // Chrome tolerates comments in manifest.json; JSON.parse does not.
          const manifest = this.adaptManifest(JSON.parse(raw.replace(/^\s*\/\/.*$/gm, "")), id);
          const stream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
          stream.setUTF8Data(JSON.stringify(manifest, null, 2));
          writer.addEntryStream(entry, Date.now() * 1000, Ci.nsIZipWriter.COMPRESSION_DEFAULT, stream, false);
        } else {
          writer.addEntryStream(entry, Date.now() * 1000, Ci.nsIZipWriter.COMPRESSION_DEFAULT, reader.getInputStream(entry), false);
        }
      }
    } finally {
      writer.close();
      reader.close();
      await IOUtils.remove(zipPath, { ignoreAbsent: true });
    }
    return xpiPath;
  },

  // Gecko's own install flow (its permission prompt included).
  async installFile(path) {
    const install = await AddonManager.getInstallForFile(new FileUtils.File(path));
    if (!install || install.error) throw new Error(`install error ${install?.error}`);
    AddonManager.installAddonFromWebpage("application/x-xpinstall", gBrowser.selectedBrowser,
      Services.scriptSecurityManager.getSystemPrincipal(), install);
    await new Promise((resolve, reject) => install.addListener({
      onInstallEnded: () => resolve(),
      onInstallCancelled: () => reject(new Error("cancelled")),
      onInstallFailed: () => reject(new Error(`failed ${install.error}`)),
      onDownloadFailed: () => reject(new Error("download failed")),
    }));
  },

  // Settings: install a .crx, .zip or .xpi file from disk.
  async installFromDisk() {
    const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    fp.init(window.browsingContext, Orbit.tr("Install an extension", "Installer une extension"), Ci.nsIFilePicker.modeOpen);
    fp.appendFilter(Orbit.tr("Extensions", "Extensions"), "*.crx;*.xpi;*.zip");
    const result = await new Promise(r => fp.open(r));
    if (result != Ci.nsIFilePicker.returnOK) return;
    const bytes = await IOUtils.read(fp.file.path);
    const signedXpi = fp.file.leafName.endsWith(".xpi");
    if (!signedXpi && !this.allowUnsigned()) return;
    try {
      const path = signedXpi ? fp.file.path : await this.toXpi(bytes, fp.file.leafName.replace(/\W+/g, "").slice(0, 32) || "local");
      await this.installFile(path);
    } catch (e) {
      console.error("Orbit: extension file", e);
      OrbitNotify.show({ kind: "chrome-ext", icon: "puzzle", tone: "warm", title: Orbit.tr("Extensions", "Extensions"),
        text: Orbit.tr("This extension could not be installed.", "Cette extension n'a pas pu être installée."), timeout: 5000 });
    }
  },
};
