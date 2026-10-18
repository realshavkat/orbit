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
      rename: Orbit.tr("Rename tab", "Renommer l'onglet"),
      resetName: Orbit.tr("Restore original name", "Rétablir le nom d'origine"),
      copy: Orbit.tr("Copy link", "Copier le lien"),
      copied: Orbit.tr("Link copied", "Lien copié"),
      glance: Orbit.tr("Open in Glance", "Ouvrir dans Glance"),
      unloadSpace: Orbit.tr("Put space to sleep", "Mettre l'espace en veille"),
      unloadOthers: Orbit.tr("Put other spaces to sleep", "Mettre les autres espaces en veille"),
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
    // Lazily restored tabs never fire SSTabRestoring: read names directly too.
    const restoreAll = () => {
      for (const tab of gBrowser.tabs) {
        const name = SessionStore.getCustomTabValue(tab, this.RENAME_KEY);
        if (name && tab.getAttribute(this.RENAME_KEY) != name) this.setName(tab, name);
      }
    };
    window.addEventListener("SSWindowRestored", restoreAll);
    setTimeout(restoreAll, 0);
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
    // Tidy once every Orbit item exists (other modules add theirs at init).
    tabMenu?.addEventListener("popupshowing", e => e.target == tabMenu && this.organizeTabMenu(tabMenu), true);
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

  // The tab menu, tidied: frequent actions first, the rest under "More".
  TAB_MENU: [
    ["context_openANewTab", "context_duplicateTab", "context_duplicateTabs", "context_reloadTab", "context_reloadSelectedTabs",
      "context_toggleMuteTab", "context_toggleMuteSelectedTabs", "context_playTab", "context_playSelectedTabs"],
    ["orbit-tab-rename", "orbit-tab-reset-name", "orbit-tab-copy", "orbit-tab-keep", "context_pinTab", "context_unpinTab",
      "context_pinSelectedTabs", "context_unpinSelectedTabs", "context_moveTabToNewGroup", "context_moveSplitViewToNewGroup",
      "context_moveTabToGroup", "context_ungroupTab", "context_ungroupSplitView", "context_moveTabToSplitView",
      "context_separateSplitView", "context_reverseSplitView", "orbit-move-to-space"],
    ["context_unloadTab", "orbit-space-unload"],
    ["context_closeTab", "context_undoCloseTab"],
  ],
  TAB_MENU_MORE: ["context_bookmarkTab", "context_bookmarkSelectedTabs", "context_moveTabOptions", "context_reopenInContainer",
    "context_selectAllTabs", "context_closeDuplicateTabs", "context_closeTabOptions", "orbit-space-unload-others",
    "context_addNote", "context_editNote", "context_shareSelectedTabs", "context_sendTabToDevice"],
  TAB_MENU_HIDDEN: ["context_askChat", "context_askChatSummarize", "context_aiSeparator", "context_openAndOrganizeSeparator",
    "context_tabStateSeparator", "context_tabToolsSeparator", "context_shareSelectedTabsSeparator", "context_sendTabToDeviceSeparator"],

  organizeTabMenu(menu) {
    if (menu.hasAttribute("orbit-organized")) return;
    menu.setAttribute("orbit-organized", "true");
    const h = Orbit.h.bind(Orbit);
    const fr = Orbit.lang() == "fr";
    const take = id => document.getElementById(id);
    // Separators Orbit did not create would sit in odd places now.
    for (const sep of [...menu.children].filter(c => c.localName == "menuseparator" && !c.id)) sep.remove();
    // An empty marker keeps the insertion point fixed while items move.
    const anchor = h("xul:menuseparator", { "orbit-hidden": "true" });
    menu.prepend(anchor);
    this.TAB_MENU.forEach((group, i) => {
      for (const id of group) {
        const el = take(id);
        if (el) menu.insertBefore(el, anchor);
      }
      if (i < this.TAB_MENU.length - 1) menu.insertBefore(h("xul:menuseparator", { class: "orbit-menu-sep" }), anchor);
    });
    const morePopup = h("xul:menupopup", { id: "orbit-tab-more-popup" });
    for (const id of this.TAB_MENU_MORE) {
      const el = take(id);
      if (el) morePopup.append(el);
    }
    menu.insertBefore(h("xul:menuseparator", { class: "orbit-menu-sep" }), anchor);
    menu.insertBefore(h("xul:menu", { id: "orbit-tab-more", label: Orbit.tr("More options", "Plus d'options") }, morePopup), anchor);
    for (const id of this.TAB_MENU_HIDDEN) take(id)?.setAttribute("orbit-hidden", "true");
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
