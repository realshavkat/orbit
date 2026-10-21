/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var OrbitChromeExt = {
  STORE: /^https:\/\/(?:chromewebstore\.google\.com\/detail\/(?:[^/]+\/)?|chrome\.google\.com\/webstore\/detail\/(?:[^/]+\/)?)([a-p]{32})/,
  CRX_URL: id => `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&acceptformat=crx2,crx3&x=id%3D${id}%26installsource%3Dondemand%26uc`,
  ALLOW: "orbit.chrome.exts.allowed",
  LIST: "orbit.chrome.exts",
  SUFFIX: "@chrome-web-store",

  pure() {
    return ChromeUtils.importESModule("resource://orbit/orbit-pure.mjs");
  },

  init() {
    this.migrateSignatures();
    const site = OrbitMods.community();
    try {
      ChromeUtils.registerWindowActor("OrbitStore", {
        parent: { esModuleURI: "resource://orbit/actors/OrbitStoreParent.sys.mjs" },
        child: { esModuleURI: "resource://orbit/actors/OrbitStoreChild.sys.mjs", events: { DOMContentLoaded: {} } },
        matches: ["https://chromewebstore.google.com/*", "https://chrome.google.com/webstore/*",
          "https://addons.mozilla.org/*", "https://zen-browser.app/*", ...(site ? [`${new URL(site).protocol}//${new URL(site).hostname}/*`] : [])],
        messageManagerGroups: ["browsers"],
        safeForUntrustedWebProcess: true,
      });
    } catch {}
    if (this._app) return;
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (win != window && win.OrbitChromeExt?._app) return;
    }
    this._app = true;
    AddonManager.addAddonListener(this._listener = {
      onUninstalled: addon => this.onUninstalled(addon),
    });
    window.addEventListener("unload", () => {
      AddonManager.removeAddonListener(this._listener);
      this._app = false;
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        if (win != window && !win.closed) {
          win.OrbitChromeExt?.init();
          break;
        }
      }
    }, { once: true });
    if (!Orbit.pref(this.ALLOW, false)) return;
    this.loadSaved().catch(e => console.error("Orbit: Chrome extension", e));
    setTimeout(() => this.checkUpdates().catch(e => console.error("Orbit: Chrome extension update", e)), 15000);
  },

  migrateSignatures() {
    if (Orbit.pref("orbit.chrome.migrated", false)) return;
    const p = Services.prefs;
    if (p.prefHasUserValue("xpinstall.signatures.required") && !p.getBoolPref("xpinstall.signatures.required")) {
      p.setBoolPref(this.ALLOW, true);
      p.clearUserPref("xpinstall.signatures.required");
    }
    p.setBoolPref("orbit.chrome.migrated", true);
  },

  saved() {
    try {
      const data = JSON.parse(Orbit.pref(this.LIST, "{}"));
      return data && typeof data == "object" ? data : {};
    } catch {
      return {};
    }
  },

  writeSaved(data) {
    Services.prefs.setStringPref(this.LIST, JSON.stringify(data));
  },

  dir() {
    return PathUtils.join(PathUtils.profileDir, "orbit-chrome-ext");
  },

  idOf(addonId) {
    return addonId?.endsWith(this.SUFFIX) ? addonId.slice(0, -this.SUFFIX.length) : null;
  },

  async onUninstalled(addon) {
    if (this._keeping) return;
    const id = this.idOf(addon?.id);
    if (!id) return;
    const data = this.saved();
    delete data[id];
    this.writeSaved(data);
    await IOUtils.remove(PathUtils.join(this.dir(), `${id}.xpi`), { ignoreAbsent: true });
  },

  async loadSaved() {
    const data = this.saved();
    for (const id of Object.keys(data)) {
      const path = PathUtils.join(this.dir(), `${id}.xpi`);
      if (!(await IOUtils.exists(path))) continue;
      await this.mount(id, path);
    }
  },

  setKeeping(on) {
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (win.OrbitChromeExt) win.OrbitChromeExt._keeping = on;
    }
  },

  async unloadAll() {
    this.setKeeping(true);
    try {
      const addons = await AddonManager.getAddonsByTypes(["extension"]);
      for (const addon of addons) {
        if (this.idOf(addon.id)) await addon.uninstall();
      }
    } finally {
      this.setKeeping(false);
    }
  },

  async mount(id, path) {
    this.setKeeping(true);
    try {
      const existing = await AddonManager.getAddonByID(`${id}${this.SUFFIX}`);
      if (existing) await existing.uninstall();
      await AddonManager.installTemporaryAddon(new FileUtils.File(path));
    } finally {
      this.setKeeping(false);
    }
  },

  async sha256(bytes) {
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  },

  async keep(id, xpiPath, hash) {
    const dir = this.dir();
    await IOUtils.makeDirectory(dir, { ignoreExisting: true });
    const dest = PathUtils.join(dir, `${id}.xpi`);
    if (xpiPath != dest) await IOUtils.copy(xpiPath, dest);
    const data = this.saved();
    data[id] = hash;
    this.writeSaved(data);
    await this.mount(id, dest);
  },

  async checkUpdates() {
    const now = Math.floor(Date.now() / 1000);
    if (now - Orbit.pref("orbit.chrome.checked", 0) < 24 * 3600) return;
    Services.prefs.setIntPref("orbit.chrome.checked", now);
    for (const [id, hash] of Object.entries(this.saved())) {
      try {
        const res = await fetch(this.CRX_URL(id), { credentials: "omit" });
        if (!res.ok) continue;
        const bytes = new Uint8Array(await res.arrayBuffer());
        const next = await this.sha256(bytes);
        if (next == hash) continue;
        const xpi = await this.toXpi(bytes, id);
        await this.keep(id, xpi, next);
      } catch (e) {
        console.error("Orbit: Chrome extension update", id, e);
      }
    }
  },

  allow() {
    if (Orbit.pref(this.ALLOW, false)) return true;
    const ok = Services.prompt.confirm(window, "Orbit", Orbit.tr(
      "Chrome extensions are not checked by Mozilla. Install this one anyway? Only install extensions you trust. You can turn this off in Settings › Privacy. Other extensions stay signature-checked.",
      "Les extensions Chrome ne sont pas vérifiées par Mozilla. Installer celle-ci quand même ? N'installe que celles en qui tu as confiance. Tu peux revenir en arrière dans Paramètres › Vie privée. Les autres extensions restent vérifiées."));
    if (ok) Services.prefs.setBoolPref(this.ALLOW, true);
    return ok;
  },

  async install(id, btn) {
    if (!this.allow()) return;
    const label = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = Orbit.tr("Installing…", "Installation…");
    }
    try {
      const res = await fetch(this.CRX_URL(id), { credentials: "omit" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const hash = await this.sha256(bytes);
      const xpi = await this.toXpi(bytes, id);
      await this.keep(id, xpi, hash);
      return true;
    } catch (e) {
      console.error("Orbit: Chrome extension", e);
      if (btn) {
        btn.disabled = false;
        btn.textContent = label;
      }
      OrbitNotify.show({ kind: "chrome-ext", icon: "puzzle", tone: "warm", title: Orbit.tr("Chrome extension", "Extension Chrome"),
        text: Orbit.tr("This extension could not be installed.", "Cette extension n'a pas pu être installée."), timeout: 5000 });
      return false;
    }
  },

  adaptManifest(manifest, id) {
    manifest.browser_specific_settings ??= {};
    manifest.browser_specific_settings.gecko ??= {};
    manifest.browser_specific_settings.gecko.id ??= `${id}@chrome-web-store`;
    delete manifest.update_url;
    delete manifest.key;
    const sw = manifest.background?.service_worker;
    if (sw) {
      manifest.background.scripts = [sw];
      if (manifest.background.type != "module") delete manifest.background.type;
    }
    return manifest;
  },

  async toXpi(crx, id) {
    const dir = PathUtils.join(PathUtils.tempDir, "orbit-chrome-ext");
    await IOUtils.makeDirectory(dir, { ignoreExisting: true });
    const zipPath = PathUtils.join(dir, `${id}.zip`);
    const xpiPath = PathUtils.join(dir, `${id}.xpi`);
    await IOUtils.write(zipPath, crx.subarray(this.pure().zipOffset(crx)));
    const reader = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
    const writer = Cc["@mozilla.org/zipwriter;1"].createInstance(Ci.nsIZipWriter);
    reader.open(new FileUtils.File(zipPath));
    try {
      await IOUtils.remove(xpiPath, { ignoreAbsent: true });
      writer.open(new FileUtils.File(xpiPath), 0x04 | 0x08 | 0x20);
      for (const entry of reader.findEntries(null)) {
        if (entry.endsWith("/") || entry.startsWith("_metadata/")) continue;
        if (entry == "manifest.json") {
          const raw = new TextDecoder().decode(NetUtil.readInputStream(reader.getInputStream(entry), reader.getEntry(entry).realSize));
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

  async installFromDisk() {
    const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    fp.init(window.browsingContext, Orbit.tr("Install an extension", "Installer une extension"), Ci.nsIFilePicker.modeOpen);
    fp.appendFilter(Orbit.tr("Extensions", "Extensions"), "*.crx;*.xpi;*.zip");
    const result = await new Promise(r => fp.open(r));
    if (result != Ci.nsIFilePicker.returnOK) return;
    const bytes = await IOUtils.read(fp.file.path);
    const signedXpi = fp.file.leafName.toLowerCase().endsWith(".xpi");
    if (!signedXpi && !this.allow()) return;
    try {
      if (signedXpi) {
        await this.installFile(fp.file.path);
      } else {
        const id = fp.file.leafName.replace(/\W+/g, "").slice(0, 32) || "local";
        const xpi = await this.toXpi(bytes, id);
        await this.keep(id, xpi, await this.sha256(bytes));
      }
    } catch (e) {
      console.error("Orbit: extension file", e);
      OrbitNotify.show({ kind: "chrome-ext", icon: "puzzle", tone: "warm", title: Orbit.tr("Extensions", "Extensions"),
        text: Orbit.tr("This extension could not be installed.", "Cette extension n'a pas pu être installée."), timeout: 5000 });
    }
  },
};
