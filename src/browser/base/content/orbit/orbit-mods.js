/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var OrbitMods = {
  DIR: "orbit-mods",
  OFF_PREF: "orbit.mods.disabled",
  STORE: "https://raw.githubusercontent.com/zen-browser/theme-store/main/themes",
  BUILTIN_THEMES: new Set(["default-theme@mozilla.org", "firefox-compact-dark@mozilla.org",
    "firefox-compact-light@mozilla.org", "firefox-alpenglow@mozilla.org"]),

  get dir() {
    return PathUtils.join(PathUtils.profileDir, this.DIR);
  },

  async init() {
    this.watchTheme();
    await this.apply();
    this._obs = () => this.schedule();
    Services.prefs.addObserver(this.OFF_PREF, this._obs);
    window.addEventListener("unload", () => {
      Services.prefs.removeObserver(this.OFF_PREF, this._obs);
      for (const name of this._watched ?? []) Services.prefs.removeObserver(name, this._obs);
    }, { once: true });
  },

  schedule() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.apply().catch(e => console.error("Orbit mods", e)), 60);
  },

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

  disabled() {
    try {
      return new Set(JSON.parse(Orbit.pref(this.OFF_PREF, "[]")));
    } catch {
      return new Set();
    }
  },

  async readJSON(path, fallback) {
    try {
      return JSON.parse(await IOUtils.readUTF8(path));
    } catch {
      return fallback;
    }
  },

  async list() {
    await IOUtils.makeDirectory(this.dir, { ignoreExisting: true });
    const out = [];
    for (const path of await IOUtils.getChildren(this.dir)) {
      const name = PathUtils.filename(path);
      const info = await IOUtils.stat(path).catch(() => null);
      if (info?.type == "directory") {
        const meta = await this.readJSON(PathUtils.join(path, "theme.json"), null);
        if (!meta && !(await IOUtils.exists(PathUtils.join(path, "chrome.css")))) continue;
        const prefs = await this.readJSON(PathUtils.join(path, "preferences.json"), []);
        out.push({ id: name, name: meta?.name || name, description: meta?.description ?? "", author: meta?.author ?? "",
          version: meta?.version ?? "", image: meta?.image ?? "", homepage: meta?.homepage ?? "", dir: path,
          prefs: Array.isArray(prefs) ? prefs.filter(p => p?.property && p?.type) : [], zen: !!(meta?.style || meta?.zen), store: !!(meta?.style || meta?.zen || meta?.orbit) });
      } else if (name.toLowerCase().endsWith(".css")) {
        out.push({ id: name, name: name.replace(/\.css$/i, ""), description: "", author: "", version: "", image: "", file: path, prefs: [] });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  },

  sanitize(property) {
    return String(property).replace(/\./g, "-");
  },

  prefValue(p) {
    const type = Services.prefs.getPrefType(p.property);
    if (p.type == "checkbox") return type == Ci.nsIPrefBranch.PREF_BOOL ? Services.prefs.getBoolPref(p.property) : !!p.defaultValue;
    if (type == Ci.nsIPrefBranch.PREF_STRING) return Services.prefs.getStringPref(p.property);
    if (type == Ci.nsIPrefBranch.PREF_INT) return String(Services.prefs.getIntPref(p.property));
    return p.defaultValue ?? "";
  },

  resolvePrefQueries(css) {
    const truth = (name, value) => {
      const type = Services.prefs.getPrefType(name);
      if (value != null) {
        const cur = type == Ci.nsIPrefBranch.PREF_STRING ? Services.prefs.getStringPref(name)
          : type == Ci.nsIPrefBranch.PREF_INT ? String(Services.prefs.getIntPref(name))
          : type == Ci.nsIPrefBranch.PREF_BOOL ? String(Services.prefs.getBoolPref(name)) : "";
        return cur == value;
      }
      return type == Ci.nsIPrefBranch.PREF_BOOL ? Services.prefs.getBoolPref(name)
        : type == Ci.nsIPrefBranch.PREF_STRING ? !!Services.prefs.getStringPref(name)
        : type == Ci.nsIPrefBranch.PREF_INT ? Services.prefs.getIntPref(name) != 0 : false;
    };
    const yes = "(min-width: 0px)";
    const no = "(max-width: -1px)";
    return css
      .replace(/\(\s*-moz-bool-pref\s*:\s*["']([^"']+)["']\s*\)/g, (_, n) => (truth(n) ? yes : no))
      .replace(/-moz-pref\(\s*["']([^"']+)["']\s*(?:,\s*["']([^"']*)["']\s*)?\)/g, (_, n, v) => (truth(n, v ?? null) ? yes : no));
  },

  async apply() {
    for (const uri of this._loaded ?? []) {
      try {
        window.windowUtils.removeSheet(uri, window.windowUtils.AUTHOR_SHEET);
      } catch {}
    }
    this._loaded = [];
    const root = document.documentElement;
    for (const [attr, isVar] of this._applied ?? []) isVar ? root.style.removeProperty(attr) : root.removeAttribute(attr);
    this._applied = [];
    const off = this.disabled();
    const watch = new Set();
    for (const mod of await this.list()) {
      if (off.has(mod.id)) continue;
      for (const p of mod.prefs) {
        watch.add(p.property);
        const v = this.prefValue(p);
        const name = this.sanitize(p.property);
        if (p.type == "dropdown" && v && v != "none") {
          root.setAttribute(name, v);
          this._applied.push([name, false]);
        } else if (p.type == "string" && v !== "") {
          root.style.setProperty(`--${name}`, v);
          this._applied.push([`--${name}`, true]);
        }
      }
      const src = mod.file ?? PathUtils.join(mod.dir, "chrome.css");
      try {
        const css = this.resolvePrefQueries(await IOUtils.readUTF8(src));
        const out = mod.file ? `${mod.file}.orbit` : PathUtils.join(mod.dir, ".orbit-chrome.css");
        await IOUtils.writeUTF8(out, css);
        const uri = Services.io.newURI(`${Services.io.newFileURI(new FileUtils.File(out)).spec}?${Date.now()}`);
        window.windowUtils.loadSheet(uri, window.windowUtils.AUTHOR_SHEET);
        this._loaded.push(uri);
      } catch (e) {
        console.error(`Orbit mod ${mod.id}`, e);
      }
    }
    for (const name of this._watched ?? []) if (!watch.has(name)) Services.prefs.removeObserver(name, this._obs);
    for (const name of watch) if (!this._watched?.has(name)) Services.prefs.addObserver(name, this._obs);
    this._watched = watch;
  },

  async toggle(id, on) {
    const off = this.disabled();
    if (on) off.delete(id);
    else off.add(id);
    Services.prefs.setStringPref(this.OFF_PREF, JSON.stringify([...off]));
  },

  setPref(p, value) {
    if (p.type == "checkbox") Services.prefs.setBoolPref(p.property, !!value);
    else Services.prefs.setStringPref(p.property, String(value));
  },

  checkId(id) {
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new Error(`bad mod id ${id}`);
  },

  async isInstalled(id) {
    this.checkId(id);
    return IOUtils.exists(PathUtils.join(this.dir, id, "theme.json"));
  },

  async fetchText(url, max = 2 * 1024 * 1024) {
    const res = await fetch(url, { credentials: "omit", cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > max) throw new Error(`${url}: too big`);
    return text;
  },

  FILES: ["theme.json", "chrome.css", "preferences.json", "readme.md"],

  community() {
    const url = Orbit.pref("orbit.community.url", "");
    return /^https?:\/\//.test(url) ? url.replace(/\/$/, "") : null;
  },

  checkSlug(slug) {
    if (!/^[a-z0-9-]{1,48}$/.test(slug)) throw new Error(`bad mod slug ${slug}`);
  },

  async isInstalledOrbit(slug) {
    this.checkSlug(slug);
    return IOUtils.exists(PathUtils.join(this.dir, `orbit-${slug}`, "theme.json"));
  },

  async writePackage(folder, pkg, extraMeta = {}) {
    const files = pkg?.files ?? {};
    if (typeof files["chrome.css"] != "string") throw new Error("package without chrome.css");
    const dir = PathUtils.join(this.dir, folder);
    await IOUtils.makeDirectory(dir, { createAncestors: true, ignoreExisting: true });
    let meta = {};
    try {
      meta = JSON.parse(files["theme.json"] ?? "{}") ?? {};
    } catch {}
    meta = { ...meta, name: pkg.name ?? meta.name, version: pkg.version ?? meta.version, ...extraMeta };
    for (const name of this.FILES) {
      const path = PathUtils.join(dir, name);
      if (name == "theme.json") await IOUtils.writeUTF8(path, JSON.stringify(meta, null, 2));
      else if (typeof files[name] == "string") await IOUtils.writeUTF8(path, files[name]);
      else await IOUtils.remove(path, { ignoreAbsent: true });
    }
    await this.toggle(folder, true);
    this.schedule();
    OrbitNotify.show({ kind: "mod", icon: "sparkles", tone: "ok", title: meta.name,
      text: Orbit.tr("Mod installed. Settings › Mods to adjust it.", "Mod installé. Paramètres › Mods pour le régler."), timeout: 4000 });
  },

  async fetchJSON(url) {
    const text = await this.fetchText(url, 3 * 1024 * 1024);
    if (text == null) throw new Error(`${url}: not found`);
    return JSON.parse(text);
  },

  async installOrbit(slug) {
    this.checkSlug(slug);
    const base = this.community();
    if (!base) throw new Error("Orbit Mods is not set up");
    const pkg = await this.fetchJSON(`${base}/api/v1/mods/${slug}/package`);
    await this.writePackage(`orbit-${slug}`, pkg, { orbit: { slug } });
  },

  async installZen(id) {
    this.checkId(id);
    const site = this.community();
    if (site) {
      try {
        const pkg = await this.fetchJSON(`${site}/api/v1/mods/zen/${id}/package`);
        return await this.writePackage(id, pkg, { id, zen: { converted: true } });
      } catch (e) {
        console.warn("Orbit mods: conversion unavailable, installing as is", e);
      }
    }
    const base = `${this.STORE}/${id}`;
    const meta = JSON.parse(await this.fetchText(`${base}/theme.json`, 64 * 1024) ?? "null");
    if (!meta || meta.id != id) throw new Error(`mod ${id} not found`);
    const css = await this.fetchText(`${base}/chrome.css`);
    if (css == null) throw new Error(`mod ${id} has no chrome.css`);
    const prefs = meta.preferences ? await this.fetchText(`${base}/preferences.json`, 256 * 1024) : null;
    const readme = await this.fetchText(`${base}/readme.md`, 256 * 1024).catch(() => null);
    const dir = PathUtils.join(this.dir, id);
    await IOUtils.makeDirectory(dir, { ignoreExisting: true });
    await IOUtils.writeUTF8(PathUtils.join(dir, "theme.json"), JSON.stringify(meta, null, 2));
    await IOUtils.writeUTF8(PathUtils.join(dir, "chrome.css"), css);
    if (prefs) {
      JSON.parse(prefs);
      await IOUtils.writeUTF8(PathUtils.join(dir, "preferences.json"), prefs);
    }
    if (readme) await IOUtils.writeUTF8(PathUtils.join(dir, "readme.md"), readme);
    await this.toggle(id, true);
    this.schedule();
    OrbitNotify.show({ kind: "mod", icon: "sparkles", tone: "ok", title: meta.name,
      text: Orbit.tr("Mod installed. Settings › Mods to adjust it.", "Mod installé. Paramètres › Mods pour le régler."), timeout: 4000 });
  },

  async remove(id) {
    const mod = (await this.list()).find(m => m.id == id);
    if (!mod) return;
    await IOUtils.remove(mod.dir ?? mod.file, { recursive: true, ignoreAbsent: true });
    if (mod.file) await IOUtils.remove(`${mod.file}.orbit`, { ignoreAbsent: true });
    this.schedule();
  },

  async update(id) {
    const mod = (await this.list()).find(m => m.id == id);
    const slug = /^orbit-([a-z0-9-]{1,48})$/.exec(id)?.[1];
    if (slug && this.community()) {
      const pkg = await this.fetchJSON(`${this.community()}/api/v1/mods/${slug}`).catch(() => null);
      if (!pkg || pkg.version == mod?.version) return false;
      await this.installOrbit(slug);
      return true;
    }
    if (!mod?.zen) return false;
    const meta = JSON.parse(await this.fetchText(`${this.STORE}/${id}/theme.json`, 64 * 1024) ?? "null");
    if (!meta || meta.version == mod.version) return false;
    await this.installZen(id);
    return true;
  },

  async create(name) {
    const id = Services.uuid.generateUUID().toString().slice(1, -1);
    const dir = PathUtils.join(this.dir, id);
    await IOUtils.makeDirectory(dir, { createAncestors: true });
    await IOUtils.writeUTF8(PathUtils.join(dir, "theme.json"), JSON.stringify({
      id, name, description: "", author: "", version: "1.0.0", homepage: "", tags: [],
    }, null, 2));
    await IOUtils.writeUTF8(PathUtils.join(dir, "preferences.json"), JSON.stringify([
      { property: `orbit.mod.${id.slice(0, 8)}.round`, label: "Coins très arrondis", type: "checkbox", defaultValue: true },
      { property: `orbit.mod.${id.slice(0, 8)}.color`, label: "Couleur d'accent", type: "string", defaultValue: "#7c86ff" },
    ], null, 2));
    const var1 = `--orbit-mod-${id.slice(0, 8)}-color`;
    await IOUtils.writeUTF8(PathUtils.join(dir, "chrome.css"), `/* ${name}: edit this file, then Settings › Mods › Reload.
   Orbit's elements: #vertical-tabs, #pinned-tabs-container, .tabbrowser-tab,
   #nav-bar, #urlbar, #orbit-sidebar-footer. Zen variables work too. */

@media (-moz-bool-pref: "orbit.mod.${id.slice(0, 8)}.round") {
  #vertical-tabs .tabbrowser-tab .tab-background { border-radius: 14px !important; }
}

#vertical-tabs .tabbrowser-tab[selected] .tab-background {
  box-shadow: inset 0 0 0 1.5px var(${var1}, #7c86ff) !important;
}
`);
    await IOUtils.writeUTF8(PathUtils.join(dir, "readme.md"), `# ${name}\n\nDescribe your mod here.\n`);
    this.schedule();
    new FileUtils.File(dir).reveal();
    return id;
  },

  async openFolder() {
    await IOUtils.makeDirectory(this.dir, { ignoreExisting: true });
    new FileUtils.File(this.dir).reveal();
  },
};
