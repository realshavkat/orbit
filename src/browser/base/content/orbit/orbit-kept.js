/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Space-pinned tabs (Zen's pinned list): the first tabs of a space, right
// under the essentials. Drag a tab to the top of the list to pin it, drag it
// below to unpin. Closing a pinned tab only puts it to sleep: it stays listed.
var OrbitKept = {
  KEY: "orbit-kept",

  t(k) {
    const fr = Orbit.lang() == "fr";
    return {
      keep: fr ? "Épingler dans l'espace" : "Pin in space",
      unkeep: fr ? "Retirer des épinglés" : "Unpin from space",
      hint: fr ? "Glisse un onglet tout en haut pour l'épingler dans l'espace" : "Drag a tab to the top to pin it in this space",
    }[k];
  },

  init() {
    const tc = gBrowser.tabContainer;
    tc.addEventListener("SSTabRestoring", e => {
      if (SessionStore.getCustomTabValue(e.target, this.KEY)) e.target.setAttribute(this.KEY, "true");
      this.sync();
    });
    // Only a drag by the user changes membership, never a programmatic move.
    tc.addEventListener("dragstart", () => (this._drag = true));
    window.addEventListener("dragend", () => setTimeout(() => (this._drag = false), 200), true);
    tc.addEventListener("TabMove", e => this._drag && this.onMove(e.target));
    // A tab opened from a pinned one lands below the pinned block, not inside it.
    tc.addEventListener("TabOpen", e => setTimeout(() => {
      const tab = e.target;
      if (tab.pinned || this.isKept(tab) || !tab.isConnected) return;
      const list = OrbitSpaces.tabsIn(OrbitSpaces.spaceOf(tab));
      const lastKept = list.findLast(t => this.isKept(t));
      if (lastKept && gBrowser.tabs.indexOf(tab) < gBrowser.tabs.indexOf(lastKept)) {
        this._moving = true;
        gBrowser.moveTabAfter(tab, lastKept);
        this._moving = false;
      }
    }, 0));
    for (const type of ["TabOpen", "TabClose", "TabShow", "TabHide", "TabPinned", "TabUnpinned"]) {
      tc.addEventListener(type, () => setTimeout(() => this.sync(), 0));
    }
    // Closing a pinned-in-space tab unloads it instead.
    const origRemove = gBrowser.removeTab.bind(gBrowser);
    gBrowser.removeTab = (tab, options = {}) => {
      if (tab?.hasAttribute(this.KEY) && !this._closing && !tab.pinned) {
        this.sleep(tab);
        return;
      }
      return origRemove(tab, options);
    };
    this.addMenu();
    // Lazily restored tabs never fire SSTabRestoring: read the value directly.
    const restoreAll = () => {
      for (const tab of gBrowser.tabs) {
        if (SessionStore.getCustomTabValue(tab, this.KEY)) tab.setAttribute(this.KEY, "true");
      }
      this.sync();
    };
    window.addEventListener("SSWindowRestored", restoreAll);
    restoreAll();
  },

  isKept(tab) {
    return tab?.hasAttribute(this.KEY);
  },

  set(tab, kept) {
    if (!tab || tab.pinned) return;
    if (kept) {
      tab.setAttribute(this.KEY, "true");
      SessionStore.setCustomTabValue(tab, this.KEY, "1");
      // Kept tabs lead the space's list.
      const first = OrbitSpaces.tabsIn(OrbitSpaces.spaceOf(tab)).find(t => t != tab && !this.isKept(t));
      if (first && gBrowser.tabs.indexOf(tab) > gBrowser.tabs.indexOf(first)) gBrowser.moveTabBefore(tab, first);
    } else {
      tab.removeAttribute(this.KEY);
      SessionStore.deleteCustomTabValue(tab, this.KEY);
    }
    this.sync();
  },

  sleep(tab) {
    if (tab.selected) {
      const next = gBrowser._findTabToBlurTo(tab);
      if (next) gBrowser.selectedTab = next;
      else gBrowser.selectedTab = OrbitSpaces.openTab();
    }
    gBrowser.discardBrowser(tab);
  },

  // After a drag: inside the pinned block (or at the very top) = pinned.
  onMove(tab) {
    if (tab.pinned || this._moving) return;
    const list = OrbitSpaces.tabsIn(OrbitSpaces.spaceOf(tab)).filter(t => !t.group || t == tab);
    const i = list.indexOf(tab);
    const before = list[i - 1];
    // Top of the list, or right under another pinned tab.
    const kept = i == 0 || this.isKept(before);
    this._moving = true;
    if (kept != this.isKept(tab)) this.set(tab, kept);
    this._moving = false;
  },

  // Marks the last pinned tab of the visible space so CSS draws the divider.
  sync() {
    const visible = gBrowser.visibleTabs.filter(t => !t.pinned);
    let last = null;
    for (const t of visible) {
      t.removeAttribute("orbit-kept-last");
      if (this.isKept(t)) last = t;
    }
    last?.setAttribute("orbit-kept-last", "true");
    document.documentElement.toggleAttribute("orbit-has-kept", !!last);
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

  // "Close all" from the clear button really closes pinned-in-space tabs too.
  closeForReal(tabs) {
    this._closing = true;
    try {
      gBrowser.removeTabs(tabs, { animate: true });
    } finally {
      this._closing = false;
    }
  },
};
