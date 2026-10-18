/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Tabs: command bar instead of empty new tabs, and idle tab unloading.
var OrbitTabs = {
  init() {
    this.initCommandBar();
    this.initUnloader();
    this.initOrbitScheme();
    this.initHome();
  },

  // ---- Home page ----------------------------------------------------------------
  // resource://orbit/home.html is a static, unprivileged page: the name, search
  // URL and shortcuts travel in its hash. It becomes the browser home page.
  HOME: "resource://orbit/home.html",
  isHome(spec) {
    return spec?.startsWith(this.HOME);
  },

  homeURL() {
    const engine = Orbit.search.hasSuccessfullyInitialized ? Orbit.search.defaultEngine : null;
    const s = engine?.getSubmission("{q}").uri.spec.replace("%7Bq%7D", "{q}") ?? "";
    const params = new URLSearchParams({ name: Orbit.pref("orbit.user.name", ""), lang: Orbit.lang(), s, t: this._tiles ?? "" });
    return `${this.HOME}#${params}`;
  },

  async refreshHome() {
    try {
      const db = await PlacesUtils.promiseDBConnection();
      const rows = await db.executeCached(
        `SELECT url, title FROM moz_places WHERE hidden = 0 AND frecency > 0 AND url LIKE 'http%'
         ORDER BY frecency DESC LIMIT 30`);
      const seen = new Set();
      const tiles = [];
      for (const r of rows) {
        const url = r.getResultByName("url");
        const host = new URL(url).hostname.replace(/^www\./, "");
        if (seen.has(host)) continue;
        seen.add(host);
        tiles.push(`${(r.getResultByName("title") || host).split(/ [-|–·] /)[0].replace(/[|\n]/g, " ")}|${new URL(url).origin}`);
        if (tiles.length == 6) break;
      }
      this._tiles = tiles.join("\n");
    } catch (e) {
      console.error("Orbit: home shortcuts", e);
    }
    Services.prefs.setStringPref("browser.startup.homepage", this.homeURL());
    // Any "new tab" Gecko opens by itself (last tab closed...) shows the home page.
    AboutNewTab.newTabURL = this.homeURL();
  },

  initHome() {
    this.refreshHome();
    const obs = () => this.refreshHome();
    Services.prefs.addObserver("orbit.user.name", obs);
    Services.obs.addObserver(obs, "browser-search-engine-modified");
    window.addEventListener("unload", () => {
      Services.prefs.removeObserver("orbit.user.name", obs);
      Services.obs.removeObserver(obs, "browser-search-engine-modified");
    }, { once: true });
  },

  // ---- orbit:// ---------------------------------------------------------------
  // orbit://<page> is Orbit's name for the built-in about:<page> pages.
  // Typing one opens the page; built-in pages are shown with orbit:// too.
  ALIASES: { home: "orbit:home", accueil: "orbit:home", memoire: "orbit:memory", memory: "orbit:memory", settings: "orbit:settings", preferences: "about:preferences", extensions: "about:addons",
    addons: "about:addons", credits: "orbit:about", about: "orbit:about" },

  resolveOrbitURL(text) {
    const m = /^orbit:(?:\/\/)?([\w-]+)(.*)$/i.exec(text.trim());
    if (!m) return null;
    const page = m[1].toLowerCase();
    return this.ALIASES[page] ? this.ALIASES[page] + (this.ALIASES[page].startsWith("about:") ? m[2] : "")
      : `about:${page}${m[2]}`;
  },

  openOrbitURL(target) {
    if (target == "orbit:settings") return OrbitSettings.open();
    if (target == "orbit:about") return OrbitSettings.open("about");
    if (target == "orbit:memory") return OrbitMemory.open();
    if (target == "orbit:home") return openTrustedLinkIn(this.homeURL(), "current");
    if (target == "about:preferences" || target.startsWith("about:preferences#")) {
      return openPreferences(target.split("#")[1]);
    }
    openTrustedLinkIn(target, "current");
  },

  displayOrbitURL() {
    const spec = gBrowser.currentURI?.spec ?? "";
    if (this.isHome(spec) && !gURLBar.focused) gURLBar.value = "";
    if (gURLBar.focused || !spec.startsWith("about:") || /^about:(blank|newtab|home)$/.test(spec)) return;
    const page = spec.slice(6).replace(/^addons/, "extensions");
    gURLBar.value = `orbit://${page}`;
  },

  initOrbitScheme() {
    gURLBar.inputField.addEventListener("keydown", e => {
      if (e.key != "Enter") return;
      const target = this.resolveOrbitURL(gURLBar.value);
      if (!target) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      gURLBar.view.close();
      gURLBar.blur();
      this.openOrbitURL(target);
    }, true);
    const origSetURI = gURLBar.setURI.bind(gURLBar);
    gURLBar.setURI = (...args) => {
      const r = origSetURI(...args);
      this.displayOrbitURL();
      return r;
    };
    gURLBar.inputField.addEventListener("blur", () => setTimeout(() => this.displayOrbitURL(), 0));
    this.displayOrbitURL();
  },

  // ---- Command bar ----------------------------------------------------------
  // Ctrl+T / "+" opens the floating URL bar; a tab is only created once the
  // user picks something. No empty new-tab page is ever rendered.
  initCommandBar() {
    const origOpenTab = BrowserCommands.openTab.bind(BrowserCommands);
    BrowserCommands.openTab = (args = {}) => {
      const middle = args.event?.button == 1;
      if (!args.url && !middle && Orbit.pref("orbit.urlbar.replace-newtab", true)) {
        this.openCommandBar();
        return;
      }
      origOpenTab(args);
    };

    const controller = gURLBar.controller;
    const origWhere = controller.whereToOpen.bind(controller);
    controller.whereToOpen = event => {
      const where = origWhere(event);
      if (!this.commandMode || where != "current") return where;
      // Reuse a blank tab instead of stacking another one next to it.
      const b = gBrowser.selectedBrowser;
      const blank = b.currentURI.spec == "about:blank" || this.isHome(b.currentURI.spec);
      return blank && !b.webProgress?.isLoadingDocument ? "current" : "tab";
    };

    gURLBar.inputField.addEventListener("blur", () => this.closeCommandBar());
    const newTabButton = document.getElementById("tabs-newtab-button");
    newTabButton?.addEventListener("click", e => {
      if (e.button == 0 && Orbit.pref("orbit.urlbar.replace-newtab", true)) {
        e.preventDefault();
        e.stopPropagation();
        this.openCommandBar();
      }
    }, true);
  },

  openCommandBar(text = "") {
    this.commandMode = true;
    document.documentElement.setAttribute("orbit-commandbar", "true");
    this._placeholder ??= gURLBar.inputField.placeholder;
    gURLBar.inputField.placeholder = Orbit.t("commandbar.placeholder");
    gURLBar.focus();
    gURLBar.value = text;
    if (text) gURLBar.inputField.setSelectionRange(text.length, text.length);
    else gURLBar.select();
    gURLBar.startQuery?.({ allowAutofill: false });
  },

  closeCommandBar() {
    if (!this.commandMode) return;
    // Let the pending load read `commandMode` before resetting it.
    setTimeout(() => {
      this.commandMode = false;
      document.documentElement.removeAttribute("orbit-commandbar");
      if (this._placeholder != null) gURLBar.inputField.placeholder = this._placeholder;
      if (!gURLBar.focused) gURLBar.handleRevert?.();
    }, 0);
  },

  // ---- Idle tab unloading ------------------------------------------------------
  initUnloader() {
    this._unloadTimer = setInterval(() => this.unloadIdleTabs(), 60_000);
    window.addEventListener("unload", () => clearInterval(this._unloadTimer), { once: true });
  },

  unloadIdleTabs() {
    const minutes = OrbitMemory.idleMinutes();
    if (minutes > 0) OrbitMemory.sleepIdle(minutes * 60_000);
  },
};
