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
    tc.addEventListener("TabUnpinned", e => {
      const space = e.target.getAttribute(this.KEY);
      if (!space) return;
      this.forget(e.target);
      if (OrbitSpaces.byId(space)) OrbitSpaces.setTabSpace(e.target, space);
      this.sync();
    });
    for (const type of ["TabOpen", "TabClose", "TabPinned", "TabSelect"]) {
      tc.addEventListener(type, () => setTimeout(() => this.sync(), 0));
    }
    const origRemove = gBrowser.removeTab.bind(gBrowser);
    gBrowser.removeTab = (tab, options = {}) => {
      if (tab?.hasAttribute(this.KEY) && !this._closing) {
        this.sleep(tab);
        return;
      }
      return origRemove(tab, options);
    };
    const origClose = BrowserCommands.closeTabOrWindow.bind(BrowserCommands);
    BrowserCommands.closeTabOrWindow = event => {
      const tab = gBrowser.selectedTab;
      if ((tab.pinned || OrbitFolders.isPinnedTab(tab)) && !gBrowser.multiSelectedTabsCount && window.location.href == AppConstants.BROWSER_CHROME_URL) {
        this.sleep(tab);
        return;
      }
      origClose(event);
    };
    this.addMenu();
    const restoreAll = () => {
      for (const tab of gBrowser.tabs) {
        const space = SessionStore.getCustomTabValue(tab, this.KEY);
        if (space && tab.pinned) tab.setAttribute(this.KEY, space);
      }
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

  set(tab, kept) {
    if (!tab) return;
    if (kept) {
      const space = OrbitSpaces.spaceOf(tab) || OrbitSpaces.activeId;
      tab.setAttribute(this.KEY, space);
      SessionStore.setCustomTabValue(tab, this.KEY, space);
      if (!tab.pinned) gBrowser.pinTab(tab);
      this.pop(tab);
    } else if (tab.pinned) {
      gBrowser.unpinTab(tab);
    }
    this.sync();
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
    const active = OrbitSpaces.activeId;
    let any = false;
    for (const tab of gBrowser.tabs) {
      if (!tab.pinned) continue;
      const space = tab.getAttribute(this.KEY);
      tab.toggleAttribute("orbit-elsewhere", !!space && space != active);
      if (space == active) any = true;
    }
    document.documentElement.toggleAttribute("orbit-has-kept", any);
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
      item.hidden = !tab || (tab.pinned && !this.isKept(tab));
      item.setAttribute("label", this.isKept(tab) ? this.t("unkeep") : this.t("keep"));
    });
  },

  closeForReal(tabs) {
    this._closing = true;
    try {
      gBrowser.removeTabs(tabs, { animate: true });
    } finally {
      this._closing = false;
    }
  },
};
