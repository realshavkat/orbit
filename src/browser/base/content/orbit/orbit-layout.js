/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Layout: sidebar sizing, compact mode, shortcuts, floating command bar.
var OrbitLayout = {
  init() {
    const root = document.documentElement;
    this.root = root;
    this.toolbox = document.getElementById("navigator-toolbox");
    this.sidebar = document.getElementById("sidebar-container");

    // Header/footer live around <sidebar-main>; spaces fill them in.
    // Space label sits between the essentials grid and the tab list.
    document.getElementById("tabbrowser-tabs").insertBefore(
      Orbit.h("xul:vbox", { id: "orbit-sidebar-header" }),
      document.getElementById("tabbrowser-arrowscrollbox")
    );
    this.sidebar.append(Orbit.h("xul:hbox", { id: "orbit-sidebar-footer", align: "center" }));
    document.body.append(Orbit.h("div", { id: "orbit-urlbar-backdrop" }));
    // Liquid background + grain (see orbit.css): two cheap fixed layers.
    document.body.prepend(Orbit.h("div", { id: "orbit-liquid" }), Orbit.h("div", { id: "orbit-grain" }));

    // Keep CSS vars in sync with real sizes.
    new ResizeObserver(([e]) =>
      root.style.setProperty("--orbit-toolbox-height", `${Math.ceil(e.borderBoxSize[0].blockSize)}px`)
    ).observe(this.toolbox);
    // Our own resize handle: the width pref is the single source of truth.
    document.getElementById("sidebar-launcher-splitter").addEventListener("mousedown", e => {
      if (e.button != 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.screenX;
      const startW = Orbit.pref("orbit.view.sidebar-width", 240);
      const dir = Orbit.pref("sidebar.position_start", true) ? 1 : -1;
      root.setAttribute("orbit-resizing", "true");
      const move = ev => this.setWidth(startW + dir * (ev.screenX - startX));
      const up = ev => {
        window.removeEventListener("mousemove", move, true);
        window.removeEventListener("mouseup", up, true);
        root.removeAttribute("orbit-resizing");
        Services.prefs.setIntPref("orbit.view.sidebar-width", this.clampWidth(startW + dir * (ev.screenX - startX)));
      };
      window.addEventListener("mousemove", move, true);
      window.addEventListener("mouseup", up, true);
    }, true);

    window.addEventListener("resize", () => this.setWidth(Orbit.pref("orbit.view.sidebar-width", 240)));
    this.applyPrefs();
    for (const branch of ["orbit.", "sidebar.position_start"]) Services.prefs.addObserver(branch, this);
    window.addEventListener("unload", () => {
      for (const branch of ["orbit.", "sidebar.position_start"]) Services.prefs.removeObserver(branch, this);
    }, { once: true });

    document.addEventListener("mousemove", this, { passive: true });
    for (const el of [this.toolbox, this.sidebar]) el.addEventListener("mouseleave", this);
    window.addEventListener("keydown", this, true);
  },

  onReady() {
    // Always show the full (expanded) vertical tab strip.
    SidebarController.promiseInitialized.then(() => {
      if (!SidebarController._state.launcherExpanded) SidebarController._state.updateVisibility(true, true);
    }).catch(e => console.error("Orbit: could not expand sidebar", e));
    // First run (or layout upgrade): Zen-like toolbar order. Users can still
    // customize afterwards; we only apply this once per layout version.
    if (Orbit.pref("orbit.layout.version", 0) < 1) {
      Services.prefs.setIntPref("orbit.layout.version", 1);
      this.resetToolbar();
    }
    // Hide the stock tool buttons inside <sidebar-main>'s shadow DOM.
    const sm = document.querySelector("sidebar-main");
    const hideTools = () => {
      if (!sm.shadowRoot || sm.shadowRoot.getElementById("orbit-style")) return;
      sm.shadowRoot.append(
        Orbit.h("style", { id: "orbit-style" },
          ".buttons-wrapper, #sidebar-tools-and-extensions-splitter { display: none !important; }" +
          ".wrapper { padding: 0 !important; }")
      );
    };
    hideTools();
    customElements.whenDefined("sidebar-main").then(() => sm.updateComplete?.then(hideTools));
  },

  // Never wider than a third of the window, so the page keeps its room.
  clampWidth(w) {
    const max = Math.max(180, Math.min(420, window.innerWidth * 0.32));
    return Math.round(Math.min(max, Math.max(180, w)));
  },

  setWidth(w) {
    this.root.style.setProperty("--orbit-sidebar-width", `${this.clampWidth(w)}px`);
  },

  resetToolbar() {
    const area = CustomizableUI.AREA_NAVBAR;
    const order = [
      "sidebar-button", "back-button", "forward-button", "stop-reload-button", "spring",
      "urlbar-container", "spring", "downloads-button", "unified-extensions-button",
    ];
    for (const id of CustomizableUI.getWidgetIdsInArea(area)) {
      if (!order.includes(id) && CustomizableUI.isWidgetRemovable(id)) CustomizableUI.removeWidgetFromArea(id);
    }
    order.forEach((id, i) => {
      if (id == "spring") return;
      CustomizableUI.addWidgetToArea(id, area, i);
    });
    // Springs are special (new id each time): add the two around the URL bar.
    const urlbarPos = () => CustomizableUI.getPlacementOfWidget("urlbar-container").position;
    CustomizableUI.addWidgetToArea("spring", area, urlbarPos());
    CustomizableUI.addWidgetToArea("spring", area, urlbarPos() + 1);
    // Moving widgets in an already-built toolbar can leave the DOM out of
    // order; re-append in placement order (later windows build correctly).
    const target = CustomizableUI.getCustomizationTarget(document.getElementById(area));
    for (const id of CustomizableUI.getWidgetIdsInArea(area)) {
      const node = document.getElementById(id);
      if (node?.parentNode == target) target.append(node);
    }
  },

  // Built-in pages (orbit://preferences...) get Orbit's look and font via
  // process-wide user sheets; registering again is a no-op.
  applyPageSheets() {
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
    const base = Services.io.newURI(`${Orbit.BASE}orbit-pages.css`);
    if (!sss.sheetRegistered(base, sss.USER_SHEET)) sss.loadAndRegisterSheet(base, sss.USER_SHEET);
    const font = Orbit.pref("orbit.theme.font", "Outfit");
    const faces = this.customFonts().map(({ name, file }) => {
      const f = Services.dirsvc.get("ProfD", Ci.nsIFile);
      f.append("orbit-fonts");
      f.append(file);
      return `@font-face { font-family: ${JSON.stringify(name)}; src: url("${Services.io.newFileURI(f).spec}"); }`;
    }).join(" ");
    const css = `${faces} :root { --orbit-page-font: ${JSON.stringify(font)}; }`;
    const uri = Services.io.newURI(`data:text/css;charset=utf-8,${encodeURIComponent(css)}`);
    if (sss.sheetRegistered(uri, sss.USER_SHEET)) return;
    for (const prev of OrbitLayout.registeredFontSheets()) {
      if (sss.sheetRegistered(prev, sss.USER_SHEET)) sss.unregisterSheet(prev, sss.USER_SHEET);
    }
    sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    Services.prefs.setStringPref("orbit.internal.page-font-sheet", uri.spec);
  },

  registeredFontSheets() {
    const spec = Orbit.pref("orbit.internal.page-font-sheet", "");
    return spec ? [Services.io.newURI(spec)] : [];
  },

  customFonts() {
    try {
      return JSON.parse(Orbit.pref("orbit.fonts.custom", "[]"));
    } catch {
      return [];
    }
  },

  // Fonts the user added live in <profile>/orbit-fonts/.
  loadCustomFonts() {
    this._loadedFonts ??= new Set();
    for (const { name, file } of this.customFonts()) {
      if (this._loadedFonts.has(name)) continue;
      const f = Services.dirsvc.get("ProfD", Ci.nsIFile);
      f.append("orbit-fonts");
      f.append(file);
      if (!f.exists()) continue;
      const face = new FontFace(name, `url("${Services.io.newFileURI(f).spec}")`);
      document.fonts.add(face);
      face.load().catch(e => console.error("Orbit: font", name, e));
      this._loadedFonts.add(name);
    }
  },

  observe(_subject, topic) {
    if (topic == "nsPref:changed") this.applyPrefs();
  },

  // Prefs -> root attributes / CSS variables (live in every window).
  applyPrefs() {
    const root = this.root;
    const flag = (attr, pref, def = true) => root.toggleAttribute(attr, !Orbit.pref(pref, def));
    flag("orbit-no-glass", "orbit.effects.glass", false);
    flag("orbit-no-nebula", "orbit.effects.nebula");
    flag("orbit-no-grain", "orbit.effects.grain");
    flag("orbit-no-motion", "orbit.effects.animations");
    root.toggleAttribute("orbit-sidebar-end", !Orbit.pref("sidebar.position_start", true));
    root.style.setProperty("--orbit-intensity", Orbit.pref("orbit.theme.intensity", 34) / 100);
    root.style.setProperty("--orbit-radius", `${Orbit.pref("orbit.theme.radius", 7)}px`);
    root.style.setProperty("--orbit-gap", `${Orbit.pref("orbit.view.gap", 8)}px`);
    this.setWidth(Orbit.pref("orbit.view.sidebar-width", 240));
    this.loadCustomFonts();
    root.style.setProperty("--orbit-font", JSON.stringify(Orbit.pref("orbit.theme.font", "Outfit")));
    this.applyPageSheets();
    const compact = Orbit.pref("orbit.view.compact", false);
    if (compact != root.hasAttribute("orbit-compact")) this.setCompact(compact);
  },

  setCompact(on) {
    this.root.toggleAttribute("orbit-compact", on);
    this.root.removeAttribute("orbit-peek");
  },

  toggleCompact() {
    Services.prefs.setBoolPref("orbit.view.compact", !this.root.hasAttribute("orbit-compact"));
  },

  handleEvent(e) {
    switch (e.type) {
      case "mousemove":
        // Reveal the floating sidebar when the pointer touches the left edge.
        if (this.root.hasAttribute("orbit-compact") && !this.root.hasAttribute("orbit-peek") && e.screenX - window.mozInnerScreenX <= 6) {
          clearTimeout(this._hideTimer);
          this.root.setAttribute("orbit-peek", "true");
        }
        break;
      case "mouseleave":
        if (this.root.hasAttribute("orbit-peek")) this.scheduleHide();
        break;
      case "keydown":
        this.onKey(e);
        break;
    }
  },

  scheduleHide() {
    clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => {
      const busy =
        this.toolbox.matches(":hover") ||
        this.sidebar.matches(":hover") ||
        gURLBar.focused ||
        document.querySelector("#navigator-toolbox [open], #sidebar-container [open], #orbit-space-editor");
      if (busy) this.scheduleHide();
      else this.root.removeAttribute("orbit-peek");
    }, 350);
  },

  onKey(e) {
    // AltGr reports Ctrl+Alt on Windows; never steal AltGr characters.
    if (e.getModifierState("AltGraph")) return;
    if (e.ctrlKey && !e.altKey && !e.shiftKey && e.code == "Comma") {
      OrbitSettings.toggle();
    } else if (e.ctrlKey && e.altKey && !e.shiftKey && e.code == "KeyC") {
      this.toggleCompact();
    } else if (e.altKey && !e.ctrlKey && !e.shiftKey && /^Digit[1-9]$/.test(e.code)) {
      OrbitSpaces.switchToIndex(+e.code.slice(5) - 1);
    } else if (e.ctrlKey && e.shiftKey && !e.altKey && e.code == "Space") {
      OrbitTabs.openCommandBar("% ");
    } else if (e.ctrlKey && e.shiftKey && !e.altKey && e.code == "KeyU") {
      OrbitAI.toggleAssistant();
    } else if (e.ctrlKey && e.altKey && (e.code == "ArrowLeft" || e.code == "ArrowRight")) {
      OrbitSpaces.cycle(e.code == "ArrowRight" ? 1 : -1);
    } else {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  },
};
