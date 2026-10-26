/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var OrbitKept = {
  KEY: "orbit-kept",

  t(k) {
    const fr = Orbit.lang() == "fr";
    return {
      keep: Orbit.tr("Pin in space", "Épingler dans l'espace"),
      unkeep: Orbit.tr("Unpin from space", "Retirer des épinglés"),
    }[k];
  },

  init() {
    const tc = gBrowser.tabContainer;
    tc.addEventListener("TabPinned", e => this.isKept(e.target) && !this._moving && this.forget(e.target));
    for (const type of ["TabOpen", "TabClose", "TabPinned", "TabSelect"]) {
      tc.addEventListener(type, () => setTimeout(() => this.sync(), 0));
    }
    const origRemove = gBrowser.removeTab.bind(gBrowser);
    gBrowser.removeTab = (tab, options = {}) => {
      if (tab?.hasAttribute(this.KEY) && !this._closing) {
        this.sleep(tab);
        return;
      }
      return options.animate ? this.flip([tab], () => origRemove(tab, options)) : origRemove(tab, options);
    };
    const origClose = BrowserCommands.closeTabOrWindow.bind(BrowserCommands);
    BrowserCommands.closeTabOrWindow = event => {
      const tab = gBrowser.selectedTab;
      if ((tab.pinned || this.isKept(tab) || OrbitFolders.isPinnedTab(tab)) && !gBrowser.multiSelectedTabsCount && window.location.href == AppConstants.BROWSER_CHROME_URL) {
        this.sleep(tab);
        return;
      }
      origClose(event);
    };
    this.addMenu();
    const restoreAll = () => {
      const legacy = [];
      for (const tab of gBrowser.tabs) {
        const space = SessionStore.getCustomTabValue(tab, this.KEY);
        if (!space) continue;
        tab.setAttribute(this.KEY, space);
        if (tab.pinned) legacy.push(tab);
      }
      this.migrate(legacy);
      this.sync();
    };
    window.addEventListener("SSWindowRestored", restoreAll);
    tc.addEventListener("SSTabRestoring", restoreAll);
    restoreAll();
  },

  isKept(tab) {
    return !!tab?.hasAttribute(this.KEY);
  },

  forget(tab) {
    tab.removeAttribute(this.KEY);
    tab.removeAttribute("orbit-elsewhere");
    SessionStore.deleteCustomTabValue(tab, this.KEY);
  },

  migrate(tabs) {
    if (!tabs.length) return;
    this._moving = true;
    try {
      for (const tab of tabs.reverse()) {
        const space = tab.getAttribute(this.KEY);
        gBrowser.unpinTab(tab);
        if (OrbitSpaces.byId(space)) OrbitSpaces.setTabSpace(tab, space);
      }
    } finally {
      this._moving = false;
    }
    OrbitSpaces.syncVisibility();
  },

  mark(tab, kept) {
    if (!tab) return;
    if (!kept) {
      this.forget(tab);
      return;
    }
    if (tab.pinned) {
      this._moving = true;
      try {
        gBrowser.unpinTab(tab);
      } finally {
        this._moving = false;
      }
    }
    const space = OrbitSpaces.spaceOf(tab) || OrbitSpaces.activeId;
    OrbitSpaces.setTabSpace(tab, space);
    tab.setAttribute(this.KEY, space);
    SessionStore.setCustomTabValue(tab, this.KEY, space);
  },

  set(tab, kept) {
    if (!tab) return;
    const zone = OrbitFolders.zoneRows().filter(r => r != tab && r != tab.group);
    this.mark(tab, kept);
    if (kept) {
      if (tab.group) gBrowser.ungroupTab?.(tab);
      if (zone.length) gBrowser.moveTabAfter(tab, zone.at(-1));
      else gBrowser.moveTabTo(tab, { tabIndex: gBrowser.pinnedTabCount });
      this.pop(tab);
    } else if (zone.length) {
      gBrowser.moveTabAfter(tab, zone.at(-1));
    }
    OrbitSpaces.syncVisibility();
  },

  pop(tab) {
    tab.removeAttribute("orbit-just-pinned");
    void tab.offsetWidth;
    tab.setAttribute("orbit-just-pinned", "true");
    setTimeout(() => tab.removeAttribute("orbit-just-pinned"), 600);
  },

  sleep(tab) {
    if (tab.selected) {
      const next = OrbitSpaces.tabsIn(OrbitSpaces.activeId).findLast(t => !t.closing && t != tab) ?? OrbitSpaces.openTab();
      gBrowser.selectedTab = next;
    }
    gBrowser.discardBrowser(tab);
  },

  sync() {
    OrbitFolders.placeHeader();
  },

  addMenu() {
    const menu = document.getElementById("tabContextMenu");
    if (!menu) return;
    const item = Orbit.h("xul:menuitem", { id: "orbit-tab-keep", oncommand: () => {
      const tab = TabContextMenu.contextTab;
      this.set(tab, !this.isKept(tab));
    } });
    menu.insertBefore(item, document.getElementById("context_pinTab"));
    menu.addEventListener("popupshowing", e => {
      if (e.target != menu) return;
      const tab = TabContextMenu.contextTab;
      item.hidden = !tab || tab.pinned;
      item.setAttribute("label", this.isKept(tab) ? this.t("unkeep") : this.t("keep"));
    });
  },

  closeForReal(tabs) {
    this._closing = true;
    try {
      this.flip(tabs, () => gBrowser.removeTabs(tabs, { animate: true }));
    } finally {
      this._closing = false;
    }
  },

  flip(tabs, remove) {
    if (this._flipping || window.gReduceMotion || !gBrowser.tabContainer.verticalMode || !Orbit.pref("orbit.effects.animations", true)) {
      return remove();
    }
    const gone = tabs.filter(t => t.visible && !t.pinned);
    const els = [...gBrowser.tabContainer.querySelectorAll(
      ".tabbrowser-tab:not([pinned]), .tab-group-label-container, #orbit-sidebar-header, #tabs-newtab-button")].filter(el => !gone.includes(el));
    const tops = els.map(el => el.getBoundingClientRect().top);
    const ghosts = [];
    for (const t of gone) {
      const r = t.getBoundingClientRect();
      if (!r.height) continue;
      const ghost = Orbit.h("div", { class: "orbit-tab-ghost" },
        Orbit.h("img", { src: t.getAttribute("image") || "chrome://global/skin/icons/defaultFavicon.svg", alt: "" }),
        Orbit.h("span", {}, t.label));
      const icon = t.querySelector(".tab-icon-stack")?.getBoundingClientRect();
      Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
        paddingInlineStart: icon?.width ? `${icon.left - r.left}px` : "" });
      ghosts.push(ghost);
    }
    document.body.append(...ghosts);
    this._flipping = true;
    try {
      return remove();
    } finally {
      this._flipping = false;
      for (const ghost of ghosts) {
        ghost.animate([{ opacity: 1 }, { opacity: 0, transform: "translateX(-12px) scale(.96)" }], { duration: 150, easing: "ease-in", fill: "forwards" })
          .finished.catch(() => {}).then(() => ghost.remove());
      }
      els.forEach((el, i) => {
        const d = el.isConnected ? tops[i] - el.getBoundingClientRect().top : 0;
        if (Math.abs(d) > 0.5) el.animate([{ transform: `translateY(${d}px)` }, { transform: "none" }], { duration: 220, easing: "cubic-bezier(.2,.9,.25,1)" });
      });
    }
  },
};
