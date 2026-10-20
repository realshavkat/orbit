/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Named sessions: a snapshot of this window (tabs, spaces, essentials,
// history of each tab) saved in the profile, restored in a new window.
// Also export and import of Orbit's settings as a JSON file.
var OrbitSessions = {
  MAX: 40,

  get FILE() {
    return PathUtils.join(PathUtils.profileDir, "orbit-sessions.json");
  },

  async list() {
    try {
      return await IOUtils.readJSON(this.FILE);
    } catch {
      return [];
    }
  },

  write(list) {
    return IOUtils.writeJSON(this.FILE, list, { tmpPath: `${this.FILE}.tmp` });
  },

  describe(s) {
    const date = new Intl.DateTimeFormat(Orbit.lang(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(s.time));
    return `${Orbit.tr("{n} tabs", "{n} onglets").replace("{n}", s.tabs)} · ${date}`;
  },

  async save(name) {
    const state = SessionStore.getWindowState(window);
    const tabs = state.windows?.[0]?.tabs?.length ?? 0;
    if (!tabs) return;
    const list = await this.list();
    const fallback = new Intl.DateTimeFormat(Orbit.lang(), { dateStyle: "medium", timeStyle: "short" }).format(new Date());
    list.unshift({ id: Services.uuid.generateUUID().toString().slice(1, 9), name: name || fallback, time: Date.now(), tabs, state });
    await this.write(list.slice(0, this.MAX));
    OrbitNotify.show({ kind: "session", icon: "download", tone: "ok", title: name || fallback, timeout: 3000,
      text: Orbit.tr("Session saved.", "Session enregistrée.") });
  },

  saveAsk() {
    OrbitPalette.ask(Orbit.tr("Name of the session", "Nom de la session"), name => this.save(name));
  },

  // In a new window, so the current tabs stay as they are.
  async restore(id) {
    const s = (await this.list()).find(x => x.id == id);
    if (!s) return;
    const win = OpenBrowserWindow();
    await new Promise(r => win.addEventListener("load", r, { once: true }));
    await win.delayedStartupPromise;
    SessionStore.setWindowState(win, s.state, true);
  },

  async remove(id) {
    await this.write((await this.list()).filter(x => x.id != id));
  },

  // ---- Firefox Sync: spaces and settings on every computer -------------------------
  // Turning it on here also turns it on on the other computers (the control
  // prefs travel with Sync). Tabs stay on their own computer.
  SYNCED: [
    "orbit.spaces.data",
    "orbit.theme.intensity",
    "orbit.theme.grain",
    "orbit.theme.grain-size",
    "orbit.theme.radius",
    "orbit.theme.font",
    "orbit.view.compact",
    "orbit.view.sidebar-width",
    "orbit.view.gap",
    "orbit.effects.glass",
    "orbit.effects.nebula",
    "orbit.effects.grain",
    "orbit.effects.animations",
    "orbit.urlbar.replace-newtab",
    "orbit.glance.enabled",
    "orbit.media.sidebar-player",
    "orbit.shortcuts",
    "orbit.split.grid",
    "orbit.downloads.turbo",
    "orbit.notify.pin",
    "orbit.notify.default",
    "orbit.notify.update",
    "orbit.notify.sleep",
    "orbit.notify.tips",
  ],

  isSynced() {
    return this.SYNCED.every(n => Orbit.pref(`services.sync.prefs.sync.${n}`, false));
  },

  setSynced(on) {
    for (const n of this.SYNCED) Services.prefs.setBoolPref(`services.sync.prefs.sync.${n}`, on);
  },

  // ---- settings export / import ---------------------------------------------------
  async pickFile(mode, title) {
    const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    fp.init(window.browsingContext, title, mode);
    fp.appendFilter("JSON", "*.json");
    if (mode == Ci.nsIFilePicker.modeSave) fp.defaultString = "orbit-settings.json";
    const res = await new Promise(r => fp.open(r));
    return res == Ci.nsIFilePicker.returnCancel ? null : fp.file.path;
  },

  async exportSettings() {
    const path = await this.pickFile(Ci.nsIFilePicker.modeSave, Orbit.tr("Export settings", "Exporter les réglages"));
    if (!path) return;
    const p = Services.prefs;
    const prefs = {};
    for (const name of p.getChildList("orbit.")) {
      // The PIN's hash stays on this PC: a 4-digit PIN is quick to guess offline.
      if (!p.prefHasUserValue(name) || name == "orbit.lock.pin") continue;
      const type = p.getPrefType(name);
      prefs[name] = type == p.PREF_BOOL ? p.getBoolPref(name) : type == p.PREF_INT ? p.getIntPref(name) : p.getStringPref(name);
    }
    await IOUtils.writeJSON(path, { orbit: 1, prefs });
    OrbitNotify.show({ kind: "settings", icon: "upload", tone: "ok", title: Orbit.tr("Settings exported", "Réglages exportés"), text: path, timeout: 4000 });
  },

  async importSettings() {
    const path = await this.pickFile(Ci.nsIFilePicker.modeOpen, Orbit.tr("Import settings", "Importer des réglages"));
    if (!path) return;
    let data;
    try {
      data = await IOUtils.readJSON(path);
    } catch {}
    if (data?.orbit != 1 || typeof data.prefs != "object") {
      OrbitNotify.show({ kind: "settings", icon: "info", tone: "warn", title: Orbit.tr("Not an Orbit settings file", "Ce n'est pas un fichier de réglages Orbit"), timeout: 4000 });
      return;
    }
    // Only Orbit's own prefs, with the type they already have.
    const p = Services.prefs;
    let n = 0;
    for (const [name, v] of Object.entries(data.prefs)) {
      if (!name.startsWith("orbit.") || name == "orbit.lock.pin") continue;
      const type = p.getPrefType(name);
      if (typeof v == "boolean" && type != p.PREF_INT && type != p.PREF_STRING) p.setBoolPref(name, v);
      else if (Number.isInteger(v) && type != p.PREF_BOOL && type != p.PREF_STRING) p.setIntPref(name, v);
      else if (typeof v == "string" && type != p.PREF_BOOL && type != p.PREF_INT) p.setStringPref(name, v);
      else continue;
      n++;
    }
    OrbitNotify.show({ kind: "settings", icon: "download", tone: "ok", title: Orbit.tr("Settings imported", "Réglages importés"),
      text: Orbit.tr("{n} settings applied. Some apply after a restart.", "{n} réglages appliqués. Certains au prochain démarrage.").replace("{n}", n), timeout: 5000 });
  },
};
