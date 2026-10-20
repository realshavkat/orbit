/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Spaces: named groups of tabs, each with its own icon and gradient.
// Pinned tabs ("essentials") are shared by every space.
// Space list lives in the `orbit.spaces.data` pref (shared by all windows);
// each tab remembers its space through SessionStore custom values.
var OrbitSpaces = {
  THEMES: [
    { id: "cosmos", c1: "#5b6cff", c2: "#3a2bd0" },
    { id: "ember", c1: "#d0714f", c2: "#4b3833" },
    { id: "nebula", c1: "#7c5cff", c2: "#e0459b" },
    { id: "ocean", c1: "#2f7bff", c2: "#14c2b0" },
    { id: "aurora", c1: "#22c58b", c2: "#62c6ff" },
    { id: "sunset", c1: "#ff8a3d", c2: "#ef3b6b" },
    { id: "lavender", c1: "#a98bff", c2: "#f5a3ff" },
    { id: "forest", c1: "#2e9c56", c2: "#b5e04a" },
    { id: "gold", c1: "#f7b52c", c2: "#ff6f7d" },
    { id: "graphite", c1: "#7b8496", c2: "#3b4252" },
  ],
  ICONS: [
    "house", "briefcase", "code", "gamepad-2", "music", "book-open", "palette", "globe",
    "heart", "star", "coffee", "rocket", "graduation-cap", "shopping-bag", "plane", "camera",
    "sparkles", "flame", "leaf", "moon", "sun", "zap", "film", "user",
  ],
  KEY: "orbitSpace",
  spaces: [],
  activeId: null,
  lastTab: new Map(),

  init() {
    this.load();
    Services.prefs.addObserver("orbit.spaces.data", this);
    window.addEventListener("unload", () => Services.prefs.removeObserver("orbit.spaces.data", this), { once: true });

    const tc = gBrowser.tabContainer;
    for (const type of ["TabOpen", "TabSelect", "TabClose", "TabPinned", "TabUnpinned", "SSTabRestoring"]) {
      tc.addEventListener(type, this);
    }
    window.addEventListener("SSWindowRestored", this);
    document.getElementById("sidebar-container").addEventListener("wheel", this, { passive: true });

    const saved = SessionStore.getCustomWindowValue(window, this.KEY);
    this.activeId = this.byId(saved) ? saved : this.spaces[0].id;
    for (const tab of gBrowser.tabs) this.adopt(tab);
    this.addTabMenu();
    this.update({ animate: false });
  },

  // ---- data ---------------------------------------------------------------
  load() {
    try {
      this.spaces = JSON.parse(Orbit.pref("orbit.spaces.data", "") || "[]");
    } catch {
      this.spaces = [];
    }
    if (!Array.isArray(this.spaces) || !this.spaces.length) {
      this.spaces = [{ id: this.newId(), name: Orbit.t("space.default"), icon: "house", theme: "cosmos" }];
      this.save();
    }
  },

  save() {
    this._saving = true;
    Services.prefs.setStringPref("orbit.spaces.data", JSON.stringify(this.spaces));
    this._saving = false;
  },

  observe() {
    if (this._saving) return;
    this.load();
    if (!this.byId(this.activeId)) this.switchTo(this.spaces[0].id);
    else this.update({ animate: false });
  },

  newId() {
    return Services.uuid.generateUUID().toString().slice(1, 9);
  },
  byId(id) {
    return this.spaces.find(s => s.id == id);
  },
  get active() {
    return this.byId(this.activeId) ?? this.spaces[0];
  },
  theme(space) {
    if (space.theme == "custom" && space.c1 && space.c2) return { id: "custom", c1: space.c1, c2: space.c2, c3: space.c3 };
    return this.THEMES.find(t => t.id == space.theme) ?? this.THEMES[0];
  },

  // ---- tabs <-> spaces ----------------------------------------------------
  spaceOf(tab) {
    return tab.getAttribute("orbit-space");
  },

  setTabSpace(tab, id) {
    tab.setAttribute("orbit-space", id);
    SessionStore.setCustomTabValue(tab, this.KEY, id);
  },

  adopt(tab) {
    if (tab.pinned) return;
    let id = this.spaceOf(tab) || SessionStore.getCustomTabValue(tab, this.KEY);
    if (!this.byId(id)) id = this.activeId;
    this.setTabSpace(tab, id);
  },

  tabsIn(id) {
    return gBrowser.tabs.filter(t => !t.pinned && !t.closing && this.spaceOf(t) == id);
  },

  // Clicking the space name folds the essentials (Zen).
  toggleEssentials() {
    document.documentElement.toggleAttribute("orbit-essentials-folded");
  },

  // Clear button: closes the space's tabs except the selected ones (the
  // current tab, or every Ctrl+clicked tab). Double-click closes them all.
  clearTabs(all = false) {
    // Pinned folders and space-pinned tabs survive a single click, like Zen;
    // a double-click closes everything, the space's pinned rows included.
    const tabs = this.tabsIn(this.activeId).filter(t => all ||
      (!OrbitFolders.isPinnedTab(t) && !(t.selected || t.multiselected)));
    if (all) tabs.push(...gBrowser.tabs.filter(t => t.getAttribute(OrbitKept.KEY) == this.activeId));
    if (!tabs.length) return;
    // Closing everything leaves the space on its home page.
    if (all) gBrowser.selectedTab = this.openTab();
    OrbitKept.closeForReal(tabs);
  },

  handleEvent(e) {
    const tab = e.target;
    switch (e.type) {
      case "TabOpen":
        if (!tab.pinned) this.setTabSpace(tab, this.activeId);
        break;
      case "SSTabRestoring": {
        const id = SessionStore.getCustomTabValue(tab, this.KEY);
        if (this.byId(id)) tab.setAttribute("orbit-space", id);
        this.syncVisibility();
        break;
      }
      case "SSWindowRestored": {
        const saved = SessionStore.getCustomWindowValue(window, this.KEY);
        if (this.byId(saved) && saved != this.activeId) this.switchTo(saved, { animate: false });
        else this.syncVisibility();
        break;
      }
      case "TabSelect":
        // Selecting a tab from another space (tab search, extension...) follows it.
        if (!tab.pinned && this.spaceOf(tab) && this.spaceOf(tab) != this.activeId) {
          this.switchTo(this.spaceOf(tab), { keepSelection: true });
        }
        break;
      case "TabClose":
        // Closing the last tab of a space keeps you in that space.
        if (tab.selected && !tab.pinned && this.tabsIn(this.activeId).length == 0 && !window.closed) {
          gBrowser.selectedTab = this.openTab();
        }
        break;
      case "TabPinned":
        tab.removeAttribute("orbit-space");
        break;
      case "TabUnpinned":
        this.setTabSpace(tab, this.activeId);
        break;
      case "wheel":
        this.onWheel(e);
        break;
    }
  },

  openTab() {
    const tab = gBrowser.addTrustedTab(OrbitTabs.homeURL(), { inBackground: false });
    this.setTabSpace(tab, this.activeId);
    return tab;
  },

  syncVisibility() {
    for (const tab of gBrowser.tabs) {
      if (tab.pinned || tab.closing) continue;
      if (!this.spaceOf(tab)) this.adopt(tab);
      // Tabs of a pinned folder show in every space.
      const inSpace = this.spaceOf(tab) == this.activeId || OrbitFolders.isEverywhere(tab);
      if (inSpace && tab.hidden) gBrowser.showTab(tab);
      else if (!inSpace && !tab.hidden) gBrowser.hideTab(tab, "orbit-spaces");
    }
    globalThis.OrbitKept?.sync();
  },

  // ---- switching ----------------------------------------------------------
  switchTo(id, { animate = true, keepSelection = false } = {}) {
    if (!this.byId(id)) return;
    const from = this.spaces.findIndex(s => s.id == this.activeId);
    const to = this.spaces.findIndex(s => s.id == id);
    const sel = gBrowser.selectedTab;
    if (!sel.pinned && this.spaceOf(sel) == this.activeId) this.lastTab.set(this.activeId, sel);
    this.activeId = id;
    SessionStore.setCustomWindowValue(window, this.KEY, id);

    if (!keepSelection && !sel.pinned) {
      const remembered = this.lastTab.get(id);
      const candidates = this.tabsIn(id);
      const target = candidates.includes(remembered)
        ? remembered
        : candidates.sort((a, b) => b.lastAccessed - a.lastAccessed)[0];
      if (target) {
        gBrowser.selectedTab = target;
      } else {
        gBrowser.selectedTab = this.openTab();
        OrbitTabs.openCommandBar?.();
      }
    }
    this.update({ animate, dir: Math.sign(to - from) || 1 });
  },

  switchToIndex(i) {
    if (this.spaces[i]) this.switchTo(this.spaces[i].id);
  },

  cycle(step) {
    const i = this.spaces.findIndex(s => s.id == this.activeId);
    this.switchTo(this.spaces[(i + step + this.spaces.length) % this.spaces.length].id);
  },

  onWheel(e) {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || this.spaces.length < 2) return;
    this._wheel = (this._wheel || 0) + e.deltaX;
    clearTimeout(this._wheelReset);
    this._wheelReset = setTimeout(() => (this._wheel = 0), 200);
    if (Math.abs(this._wheel) > 60 && !this._wheelLock) {
      this.cycle(this._wheel > 0 ? 1 : -1);
      this._wheel = 0;
      this._wheelLock = true;
      setTimeout(() => (this._wheelLock = false), 450);
    }
  },

  // ---- rendering ----------------------------------------------------------
  update({ animate = true, dir = 1 } = {}) {
    this.syncVisibility();
    const space = this.active;
    const theme = this.theme(space);
    const root = document.documentElement;
    root.style.setProperty("--orbit-c1", theme.c1);
    root.style.setProperty("--orbit-c2", theme.c2);
    root.style.setProperty("--orbit-c3", theme.c3 ?? theme.c2);
    this.render();
    if (animate && !window.gReduceMotion) {
      // Tabs of the new space cascade in from the side we're moving towards.
      const frames = [
        { opacity: 0, transform: `translateX(${dir * 18}px)` },
        { opacity: 1, transform: "none" },
      ];
      const ease = "cubic-bezier(.2,.9,.25,1)";
      document.getElementById("orbit-space-title")?.animate(frames, { duration: 340, easing: ease });
      gBrowser.visibleTabs.filter(t => !t.pinned).slice(0, 16).forEach((tab, i) =>
        tab.animate(frames, { duration: 320, delay: 20 + i * 18, easing: ease, fill: "backwards" })
      );
    }
  },

  render() {
    const { h, icon, t } = this.helpers();
    const fr = Orbit.lang() == "fr";
    const space = this.active;

    const header = document.getElementById("orbit-sidebar-header");
    header.replaceChildren(
      h("div", { id: "orbit-space-title", ondblclick: () => this.edit(space) },
        h("span", { class: "orbit-space-name", title: t("space.collapse"), onclick: () => this.toggleEssentials() }, space.name),
        h("button", { id: "orbit-space-colors", class: "orbit-icon-button", title: Orbit.tr("Colors", "Couleurs"),
          onclick: e => OrbitColors.toggle(e.currentTarget) }, icon("palette")),
        h("button", { id: "orbit-space-edit", class: "orbit-icon-button", title: t("space.edit"), onclick: () => this.edit(space) },
          icon("pencil")),
        h("button", {
          id: "orbit-space-clear", class: "orbit-icon-button",
          title: Orbit.tr("Close unselected tabs (double-click: close all)", "Fermer les onglets non sélectionnés (double-clic : tout fermer)"),
          onclick: e => e.detail < 2 && this.clearTabs(),
          ondblclick: e => { e.stopPropagation(); this.clearTabs(true); },
        }, icon("brush-cleaning"))
      )
    );

    this.indicator ??= h("div", { id: "orbit-space-indicator" });
    const footer = document.getElementById("orbit-sidebar-footer");
    footer.replaceChildren(
      h("button", {
        class: "orbit-icon-button", id: "orbit-compact-button", title: `${t("compact.toggle")} (Ctrl+Alt+C)`,
        onclick: () => OrbitLayout.toggleCompact(),
      }, icon("panel-left")),
      h("div", { id: "orbit-drop-hint" }, Orbit.tr("Drop on a space to move the tab there", "Lâchez sur un espace pour y déplacer l'onglet")),
      h("div", { id: "orbit-space-switcher" },
        this.indicator,
        ...this.spaces.map((s, i) =>
          h("button", {
            class: "orbit-space-button", title: `${s.name} (Alt+${i + 1})`, "data-space-id": s.id,
            active: s.id == space.id, style: `--c1:${this.theme(s).c1};--c2:${this.theme(s).c2}`,
            onclick: () => this.switchTo(s.id),
            oncontextmenu: ev => { ev.preventDefault(); this.edit(s); },
          }, icon(s.icon))
        )
      ),
      h("button", { class: "orbit-icon-button", title: t("space.new"), onclick: () => this.edit(null) }, icon("plus")),
      h("button", { class: "orbit-icon-button", title: `${t("settings")} (Ctrl+,)`, onclick: () => OrbitSettings.toggle() }, icon("settings-2"))
    );
    requestAnimationFrame(() => this.moveIndicator());
    // Keep the pill under the active space when the sidebar is resized.
    this._indicatorObserver ??= new ResizeObserver(() => this.moveIndicator());
    this._indicatorObserver.observe(footer);
  },

  // Glide the gradient pill under the active space button.
  moveIndicator() {
    const btn = document.querySelector(".orbit-space-button[active]");
    if (!btn) return;
    this.indicator.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
    btn.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  },

  helpers() {
    return { h: Orbit.h.bind(Orbit), icon: Orbit.icon.bind(Orbit), t: Orbit.t.bind(Orbit) };
  },

  // ---- editor (create / edit / delete) -------------------------------------
  edit(space) {
    const { h, icon, t } = this.helpers();
    document.getElementById("orbit-space-editor")?.remove();
    const draft = space ? { ...space } : { id: this.newId(), name: "", icon: this.ICONS[1], theme: this.THEMES[this.spaces.length % this.THEMES.length].id };
    const close = () => {
      card.classList.add("closing");
      setTimeout(() => card.remove(), 160);
    };
    const commit = () => {
      draft.name = input.value.trim() || t("space.new");
      if (space) Object.assign(space, draft);
      else this.spaces.push(draft);
      this.save();
      close();
      if (space) this.update({ animate: false });
      else this.switchTo(draft.id);
    };
    const pick = (cls, key, value) => {
      draft[key] = value;
      for (const b of card.querySelectorAll(`.${cls}`)) b.toggleAttribute("active", b.dataset.value == value);
      if (key == "theme") card.style.cssText = this.vars(draft);
    };

    const input = h("input", {
      class: "orbit-input", value: draft.name, placeholder: t("space.name"), maxlength: 32,
      onkeydown: e => {
        if (e.key == "Enter") commit();
        if (e.key == "Escape") close();
      },
    });
    const card = h("div", { id: "orbit-space-editor", style: this.vars(draft), onkeydown: e => e.key == "Escape" && close() },
      h("div", { class: "orbit-editor-title" }, space ? t("space.edit") : t("space.new")),
      input,
      h("div", { class: "orbit-editor-label" }, t("space.icon")),
      h("div", { class: "orbit-icon-grid" },
        ...this.ICONS.map(name =>
          h("button", { class: "orbit-pick-icon", "data-value": name, active: name == draft.icon, onclick: () => pick("orbit-pick-icon", "icon", name) }, icon(name))
        )
      ),
      h("div", { class: "orbit-editor-label" }, t("space.theme")),
      h("div", { class: "orbit-theme-grid" },
        ...this.THEMES.map(th =>
          h("button", { class: "orbit-pick-theme", "data-value": th.id, active: th.id == draft.theme, style: `--c1:${th.c1};--c2:${th.c2}`, onclick: () => pick("orbit-pick-theme", "theme", th.id) })
        )
      ),
      h("div", { class: "orbit-editor-actions" },
        space && this.spaces.length > 1
          ? h("button", { class: "orbit-button danger", onclick: () => { close(); this.remove(space); } }, icon("trash-2"))
          : null,
        h("span", { class: "orbit-spacer" }),
        h("button", { class: "orbit-button", onclick: close }, t("space.cancel")),
        h("button", { class: "orbit-button primary", onclick: commit }, space ? t("space.save") : t("space.create"))
      )
    );
    document.body.append(card);
    input.focus();
    input.select();
    // Click outside closes.
    setTimeout(() =>
      window.addEventListener("mousedown", function out(e) {
        if (!card.isConnected) return window.removeEventListener("mousedown", out, true);
        if (!card.contains(e.target)) {
          window.removeEventListener("mousedown", out, true);
          close();
        }
      }, true)
    );
  },

  vars(space) {
    const th = this.theme(space);
    return `--c1:${th.c1};--c2:${th.c2}`;
  },

  remove(space) {
    const ok = Services.prompt.confirm(window, space.name, Orbit.t("space.delete.confirm"));
    if (!ok) return;
    const tabs = this.tabsIn(space.id);
    this.spaces = this.spaces.filter(s => s != space);
    this.save();
    if (this.activeId == space.id) this.switchTo(this.spaces[0].id);
    gBrowser.removeTabs(tabs, { animate: false, suppressWarnAboutClosingWindow: true });
    this.render();
  },

  // ---- tab context menu: "Move to space" ------------------------------------
  addTabMenu() {
    const menu = document.getElementById("tabContextMenu");
    if (!menu) return;
    const popup = Orbit.h("xul:menupopup", { id: "orbit-move-to-space-popup" });
    const item = Orbit.h("xul:menu", { id: "orbit-move-to-space", label: Orbit.t("space.new") }, popup);
    menu.insertBefore(item, document.getElementById("context_moveTabOptions")?.nextSibling ?? null);
    menu.addEventListener("popupshowing", e => {
      if (e.target != menu) return;
      const tab = TabContextMenu.contextTab;
      const fr = Services.locale.appLocaleAsBCP47.startsWith("fr");
      item.setAttribute("label", Orbit.tr("Move to space", "Déplacer vers l'espace"));
      item.hidden = !tab || tab.pinned || this.spaces.length < 2;
      popup.replaceChildren(
        ...this.spaces.filter(s => s.id != this.spaceOf(tab)).map(s =>
          Orbit.h("xul:menuitem", {
            label: s.name,
            oncommand: () => this.moveTabs(gBrowser.selectedTabs.includes(tab) ? gBrowser.selectedTabs : [tab], s.id),
          })
        )
      );
    });
  },

  moveTabs(tabs, id) {
    for (const tab of tabs) if (!tab.pinned) this.setTabSpace(tab, id);
    if (this.tabsIn(this.activeId).length == 0) gBrowser.selectedTab = this.openTab();
    else if (tabs.includes(gBrowser.selectedTab)) gBrowser.selectedTab = this.tabsIn(this.activeId)[0];
    this.syncVisibility();
  },
};
