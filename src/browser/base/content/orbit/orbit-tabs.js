/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Tabs: command bar instead of empty new tabs (idle sleep lives in OrbitMemory).
var OrbitTabs = {
  init() {
    this.initCommandBar();
    this.initOrbitScheme();
    this.initHome();
    this.initDrag();
  },

  // ---- Tab drag and drop ------------------------------------------------------
  // While a tab is dragged: the background pauses (smooth 60 fps), drop zones
  // say what they do, and the space buttons accept the tab.
  TAB_DROP_TYPE: "application/x-moz-tabbrowser-tab",

  initDrag() {
    const tc = gBrowser.tabContainer;
    // "New tab" sits above the list in its own row. Moving it in the DOM (not
    // with CSS order) keeps Firefox's drag geometry right, so drags stay smooth.
    const newTab = document.getElementById("tabs-newtab-button");
    const header = document.getElementById("orbit-sidebar-header");
    if (newTab && header) header.after(newTab);
    const root = document.documentElement;
    const fr = Orbit.lang() == "fr";
    const text = document.getElementById("pinned-drop-indicator-text");
    if (text) {
      text.removeAttribute("data-l10n-id");
      text.textContent = Orbit.tr("Drop here to add to Essentials", "Lâchez ici pour l'ajouter aux favoris");
    }
    // Only freshly opened tabs slide in; a tab moved by drag must not replay it.
    tc.addEventListener("TabOpen", e => {
      e.target.setAttribute("orbit-new", "true");
      setTimeout(() => e.target.removeAttribute("orbit-new"), 400);
    });
    tc.addEventListener("dragstart", e => {
      const tab = e.target.closest?.(".tabbrowser-tab");
      if (tab) root.setAttribute("orbit-dragging", tab.pinned ? "pinned" : "tab");
    });
    new MutationObserver(() => {
      if (!tc.hasAttribute("movingtab")) setTimeout(() => !tc.hasAttribute("movingtab") && root.removeAttribute("orbit-dragging"), 50);
    }).observe(tc, { attributes: true, attributeFilter: ["movingtab"] });
    window.addEventListener("dragend", () => root.removeAttribute("orbit-dragging"), true);
    window.addEventListener("drop", () => root.removeAttribute("orbit-dragging"), true);
  },

  // Space buttons in the footer: drop a tab on one to move it there.
  dropTarget(el, onTab) {
    const has = e => e.dataTransfer?.types.includes(this.TAB_DROP_TYPE);
    el.addEventListener("dragover", e => {
      if (!has(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      el.setAttribute("drop-over", "true");
    });
    el.addEventListener("dragleave", () => el.removeAttribute("drop-over"));
    el.addEventListener("drop", e => {
      el.removeAttribute("drop-over");
      if (!has(e)) return;
      e.preventDefault();
      e.stopPropagation();
      const tab = e.dataTransfer.mozGetDataAt(this.TAB_DROP_TYPE, 0);
      if (tab?.ownerGlobal == window) onTab(tab);
    });
  },

  // ---- Home page ----------------------------------------------------------------
  // orbit://home (resource://orbit/home.html) is a static, unprivileged page;
  // the OrbitHome actor hands it the greeting, search engine and shortcuts.
  HOME: "resource://orbit/home.html",
  isHome(spec) {
    return spec?.startsWith(this.HOME);
  },

  homeURL() {
    return this.HOME;
  },

  initHome() {
    try {
      ChromeUtils.registerWindowActor("OrbitHome", {
        parent: { esModuleURI: "resource://orbit/actors/OrbitHomeParent.sys.mjs" },
        child: {
          esModuleURI: "resource://orbit/actors/OrbitHomeChild.sys.mjs",
          events: { "OrbitHome:Ready": { wantUntrusted: true }, "OrbitHome:AddTile": { wantUntrusted: true },
            "OrbitHome:RemoveTile": { wantUntrusted: true } },
        },
        matches: [`${this.HOME}*`],
        messageManagerGroups: ["browsers"],
        // The parent only answers Orbit's own home page (it checks the URL).
        safeForUntrustedWebProcess: true,
      });
    } catch {}
    Services.prefs.setStringPref("browser.startup.homepage", this.HOME);
    // Any "new tab" Gecko opens by itself (last tab closed...) shows the home page,
    // and it counts as an empty page: blank address bar, focus in it.
    AboutNewTab.newTabURL = this.HOME;
    if (!gInitialPages.includes(this.HOME)) gInitialPages.push(this.HOME);
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
    if (this.isHome(spec) && !gURLBar.focused) gURLBar.value = "orbit://home";
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
};
