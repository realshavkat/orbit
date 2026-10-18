/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Small tab features from Zen: rename a tab (double-click its title),
// copy its link, open a link in Glance, unload a space, close a tab and go
// back to the last used one, duplicate with Ctrl+Shift+D.
var OrbitExtras = {
  RENAME_KEY: "orbit-label",

  t(k) {
    const fr = Orbit.lang() == "fr";
    return {
      rename: fr ? "Renommer l'onglet" : "Rename tab",
      resetName: fr ? "Rétablir le nom d'origine" : "Restore original name",
      copy: fr ? "Copier le lien" : "Copy link",
      copied: fr ? "Lien copié" : "Link copied",
      glance: fr ? "Ouvrir dans Glance" : "Open in Glance",
      unloadSpace: fr ? "Mettre l'espace en veille" : "Put space to sleep",
      unloadOthers: fr ? "Mettre les autres espaces en veille" : "Put other spaces to sleep",
    }[k];
  },

  init() {
    this.initRename();
    this.initMenus();
    this.initLastUsed();
    window.addEventListener("keydown", e => {
      if (e.getModifierState("AltGraph")) return;
      if (e.ctrlKey && e.shiftKey && !e.altKey && e.code == "KeyD") {
        e.preventDefault();
        e.stopPropagation();
        gBrowser.selectedTab = gBrowser.duplicateTab(gBrowser.selectedTab);
      }
    }, true);
  },

  // ---- rename ---------------------------------------------------------------------
  initRename() {
    const tc = gBrowser.tabContainer;
    // A renamed tab keeps its name when the page changes its title.
    const origTitle = gBrowser.setTabTitle.bind(gBrowser);
    gBrowser.setTabTitle = tab => {
      const name = tab.getAttribute(this.RENAME_KEY);
      return name ? gBrowser.setTabLabelForAuthPrompts(tab, name) : origTitle(tab);
    };
    tc.addEventListener("SSTabRestoring", e => {
      const name = SessionStore.getCustomTabValue(e.target, this.RENAME_KEY);
      if (name) this.setName(e.target, name);
    });
    tc.addEventListener("dblclick", e => {
      const label = e.target.closest?.(".tab-label-container");
      const tab = e.target.closest?.(".tabbrowser-tab");
      if (!label || !tab || tab.pinned) return;
      e.preventDefault();
      e.stopPropagation();
      this.rename(tab);
    }, true);
  },

  setName(tab, name) {
    if (name) {
      tab.setAttribute(this.RENAME_KEY, name);
      SessionStore.setCustomTabValue(tab, this.RENAME_KEY, name);
      gBrowser.setTabTitle(tab);
    } else {
      tab.removeAttribute(this.RENAME_KEY);
      SessionStore.deleteCustomTabValue(tab, this.RENAME_KEY);
      gBrowser.setTabTitle(tab);
    }
  },

  // Inline editor over the tab title.
  rename(tab) {
    const box = tab.querySelector(".tab-label-container");
    if (!box || tab.querySelector(".orbit-rename")) return;
    const input = Orbit.h("input", { class: "orbit-rename", value: tab.label, maxlength: 80, "aria-label": this.t("rename") });
    box.after(input);
    box.hidden = true;
    input.focus();
    input.select();
    let done = false;
    const finish = save => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      input.remove();
      box.hidden = false;
      if (save) this.setName(tab, v);
    };
    input.addEventListener("keydown", e => {
      e.stopPropagation();
      if (e.key == "Enter") finish(true);
      else if (e.key == "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
    for (const type of ["mousedown", "click", "dblclick"]) input.addEventListener(type, e => e.stopPropagation());
  },

  // ---- context menus -----------------------------------------------------------------
  initMenus() {
    const h = Orbit.h.bind(Orbit);
    const tabMenu = document.getElementById("tabContextMenu");
    if (tabMenu) {
      const rename = h("xul:menuitem", { id: "orbit-tab-rename", label: this.t("rename"),
        oncommand: () => this.rename(TabContextMenu.contextTab) });
      const reset = h("xul:menuitem", { id: "orbit-tab-reset-name", label: this.t("resetName"),
        oncommand: () => this.setName(TabContextMenu.contextTab, "") });
      const copy = h("xul:menuitem", { id: "orbit-tab-copy", label: this.t("copy"),
        oncommand: () => this.copy(TabContextMenu.contextTab.linkedBrowser.currentURI.spec) });
      const sleepSpace = h("xul:menuitem", { id: "orbit-space-unload", label: this.t("unloadSpace"),
        oncommand: () => this.unloadSpace(OrbitSpaces.spaceOf(TabContextMenu.contextTab)) });
      const sleepOthers = h("xul:menuitem", { id: "orbit-space-unload-others", label: this.t("unloadOthers"),
        oncommand: () => this.unloadOtherSpaces() });
      const first = tabMenu.firstElementChild;
      tabMenu.insertBefore(rename, first);
      tabMenu.insertBefore(reset, first);
      tabMenu.insertBefore(copy, first);
      tabMenu.insertBefore(h("xul:menuseparator"), first);
      tabMenu.append(h("xul:menuseparator"), sleepSpace, sleepOthers);
      tabMenu.addEventListener("popupshowing", e => {
        if (e.target != tabMenu) return;
        const tab = TabContextMenu.contextTab;
        rename.hidden = !tab || tab.pinned;
        reset.hidden = !tab?.hasAttribute(this.RENAME_KEY);
        sleepSpace.hidden = !tab || tab.pinned;
        sleepOthers.hidden = OrbitSpaces.spaces.length < 2;
      });
    }
    const linkMenu = document.getElementById("contentAreaContextMenu");
    if (linkMenu) {
      const glance = h("xul:menuitem", { id: "orbit-context-glance", label: this.t("glance"),
        oncommand: () => OrbitGlance.open?.(gContextMenu.linkURL) });
      linkMenu.insertBefore(glance, document.getElementById("context-openlinkintab"));
      linkMenu.addEventListener("popupshowing", e => {
        if (e.target != linkMenu) return;
        glance.hidden = !gContextMenu?.onLink || !/^https?:/.test(gContextMenu.linkURL ?? "") || !OrbitGlance.open;
      });
    }
  },

  copy(text) {
    Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(text);
    OrbitNotify.show({ kind: "copy", icon: "copy", tone: "ok", title: this.t("copied"), text, timeout: 2000 });
  },

  unloadSpace(id) {
    for (const tab of OrbitSpaces.tabsIn(id)) if (OrbitMemory.canSleep(tab)) gBrowser.discardBrowser(tab);
  },

  unloadOtherSpaces() {
    for (const s of OrbitSpaces.spaces) if (s.id != OrbitSpaces.activeId) this.unloadSpace(s.id);
  },

  // ---- closing a tab goes back to the last one used (in the same space) ---------
  initLastUsed() {
    const orig = gBrowser._findTabToBlurTo.bind(gBrowser);
    gBrowser._findTabToBlurTo = (tab, ...rest) => {
      if (!tab?.selected || tab.pinned) return orig(tab, ...rest);
      const space = OrbitSpaces.spaceOf(tab);
      const candidates = gBrowser.visibleTabs.filter(t => t != tab && !t.closing && !t.pinned &&
        OrbitSpaces.spaceOf(t) == space && !rest[0]?.includes?.(t));
      if (!candidates.length) return orig(tab, ...rest);
      return candidates.reduce((a, b) => (b.lastAccessed > a.lastAccessed ? b : a));
    };
  },
};
