/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Themes and mods.
// - Firefox themes (addons.mozilla.org) take over Orbit's colors and header
//   image; Orbit's liquid background steps aside while one is active.
// - Mods: any .css file in <profile>/orbit-mods/ restyles or animates Orbit's
//   interface (each can be switched off in Settings). userChrome.css works too.
var OrbitMods = {
  DIR: "orbit-mods",
  OFF_PREF: "orbit.mods.disabled",
  BUILTIN_THEMES: new Set(["default-theme@mozilla.org", "firefox-compact-dark@mozilla.org",
    "firefox-compact-light@mozilla.org", "firefox-alpenglow@mozilla.org"]),

  get dir() {
    return PathUtils.join(PathUtils.profileDir, this.DIR);
  },

  async init() {
    this.watchTheme();
    await this.apply();
    const obs = () => this.apply();
    Services.prefs.addObserver(this.OFF_PREF, obs);
    window.addEventListener("unload", () => Services.prefs.removeObserver(this.OFF_PREF, obs), { once: true });
  },

  // ---- Firefox themes -------------------------------------------------------------
  watchTheme() {
    const sync = async () => {
      const [theme] = await AddonManager.getAddonsByTypes(["theme"]).then(all => all.filter(a => a.isActive));
      document.documentElement.toggleAttribute("orbit-addon-theme", !!theme && !this.BUILTIN_THEMES.has(theme.id));
    };
    const listener = { onEnabled: a => a.type == "theme" && sync(), onDisabled: a => a.type == "theme" && sync() };
    AddonManager.addAddonListener(listener);
    window.addEventListener("unload", () => AddonManager.removeAddonListener(listener), { once: true });
    sync();
  },

  // ---- CSS mods -------------------------------------------------------------------
  disabled() {
    try {
      return new Set(JSON.parse(Orbit.pref(this.OFF_PREF, "[]")));
    } catch {
      return new Set();
    }
  },

  async list() {
    await IOUtils.makeDirectory(this.dir, { ignoreExisting: true });
    const files = await IOUtils.getChildren(this.dir);
    return files.filter(f => f.toLowerCase().endsWith(".css")).map(f => PathUtils.filename(f)).sort();
  },

  // Mods are author sheets on this window only: each window applies them.
  async apply() {
    for (const uri of this._loaded ?? []) {
      try {
        window.windowUtils.removeSheet(uri, window.windowUtils.AUTHOR_SHEET);
      } catch {}
    }
    this._loaded = [];
    const off = this.disabled();
    for (const name of await this.list()) {
      if (off.has(name)) continue;
      const uri = Services.io.newFileURI(new FileUtils.File(PathUtils.join(this.dir, name)));
      // A query string defeats the stylesheet cache, so edits show on reload.
      const fresh = Services.io.newURI(`${uri.spec}?${Date.now()}`);
      try {
        window.windowUtils.loadSheet(fresh, window.windowUtils.AUTHOR_SHEET);
        this._loaded.push(fresh);
      } catch (e) {
        console.error(`Orbit mod ${name}`, e);
      }
    }
  },

  async toggle(name, on) {
    const off = this.disabled();
    if (on) off.delete(name);
    else off.add(name);
    Services.prefs.setStringPref(this.OFF_PREF, JSON.stringify([...off]));
  },

  async openFolder() {
    await IOUtils.makeDirectory(this.dir, { ignoreExisting: true });
    // A starter file shows how a mod looks.
    const sample = PathUtils.join(this.dir, "exemple-animation.css.txt");
    if (!(await IOUtils.exists(sample))) {
      await IOUtils.writeUTF8(sample, `/* Renomme ce fichier en .css pour l'activer. Exemple : onglets qui respirent. */
@keyframes mon-souffle { 50% { transform: scale(1.02); } }
#vertical-tabs .tabbrowser-tab[selected] .tab-background { animation: mon-souffle 3s ease-in-out infinite; }
`);
    }
    new FileUtils.File(this.dir).reveal();
  },
};
