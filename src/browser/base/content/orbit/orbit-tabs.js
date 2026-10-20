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
    this.initTabNotes();
  },

  // Firefox opens the tab note panel on the sidebar's outer side, outside the
  // window when Orbit sits at the screen edge: open it toward the page instead.
  initTabNotes() {
    const panel = document.getElementById("tabNotePanel");
    if (!panel) return;
    const open = panel.openPopup.bind(panel);
    panel.openPopup = (anchor, options = {}) => {
      if (gBrowser.tabContainer.verticalMode) {
        options = { ...options, position: SidebarController._positionStart ? "topright topleft" : "topleft topright" };
      }
      return open(anchor, options);
    };
  },

  // ---- Split view up to 4 pages (Firefox's own split view, which holds any number) --
  SPLIT_MAX: 4,

  splitSelected() {
    const tabs = gBrowser.selectedTabs.filter(t => !t.pinned && !t.splitview).slice(0, this.SPLIT_MAX);
    if (tabs.length < 2) return this.addToSplit();
    gBrowser.addTabSplitView(tabs, { insertBefore: tabs[0] });
  },

  // One more page in the current split view, picked from the open tabs page.
  addToSplit() {
    const split = gBrowser.selectedTab.splitview;
    if (!split) return document.getElementById("Browser:AddTabSplitView")?.doCommand();
    if (split.tabs.length >= this.SPLIT_MAX) return;
    const tab = gBrowser.addTrustedTab("about:opentabs");
    split.addTabs([tab]);
    gBrowser.selectedTab = tab;
  },

  toggleSplitGrid() {
    Services.prefs.setBoolPref("orbit.split.grid", !Orbit.pref("orbit.split.grid", true));
  },

  // ---- Sidebar rows (dragging itself lives in OrbitDnD) -------------------------
  initDrag() {
    const tc = gBrowser.tabContainer;
    // "New tab" sits above the list in its own row. Moving it in the DOM (not
    // with CSS order) keeps Firefox's drag geometry right, so drags stay smooth.
    this.placeNewTab();
    Services.prefs.addObserver("sidebar.verticalTabs", this.placeNewTab);
    window.addEventListener("unload", () => Services.prefs.removeObserver("sidebar.verticalTabs", this.placeNewTab), { once: true });
    // Only freshly opened tabs slide in; a tab moved by drag must not replay it.
    tc.addEventListener("TabOpen", e => {
      e.target.setAttribute("orbit-new", "true");
      setTimeout(() => e.target.removeAttribute("orbit-new"), 400);
    });
  },

  // Vertical: under the space header. Tabs on top: after the last tab, where
  // Firefox keeps it (setTimeout: Firefox moves the tabs on the same change).
  placeNewTab: () => setTimeout(() => {
    const newTab = document.getElementById("tabs-newtab-button");
    const header = document.getElementById("orbit-sidebar-header");
    const periphery = document.getElementById("tabbrowser-arrowscrollbox-periphery");
    if (!newTab || !header) return;
    if (Orbit.pref("sidebar.verticalTabs", true)) header.after(newTab);
    else periphery?.prepend(newTab);
  }, 0),

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
  resolveOrbitURL(text) {
    return ChromeUtils.importESModule("resource://orbit/orbit-pure.mjs").resolveOrbitURL(text);
  },

  openOrbitURL(target) {
    if (target == "orbit:settings") return OrbitSettings.open();
    if (target == "orbit:about") return OrbitSettings.open("about");
    if (target == "orbit:memory") return OrbitMemory.open();
    if (target == "orbit:home") return openTrustedLinkIn(this.homeURL(), "current");
    if (target == "orbit:downloads") return switchToTabHavingURI(OrbitDownloads.PAGE, true);
    if (target == "about:preferences" || target.startsWith("about:preferences#")) {
      return openPreferences(target.split("#")[1]);
    }
    openTrustedLinkIn(target, "current");
  },

  displayOrbitURL() {
    const spec = gBrowser.currentURI?.spec ?? "";
    if (this.isHome(spec) && !gURLBar.focused) gURLBar.value = "orbit://home";
    if (spec.startsWith(OrbitDownloads.PAGE) && !gURLBar.focused) gURLBar.value = "orbit://downloads";
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
