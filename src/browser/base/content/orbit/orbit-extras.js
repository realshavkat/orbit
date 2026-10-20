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
      tag: Orbit.tr("Add a tag…", "Ajouter un tag…"),
      editTag: Orbit.tr("Edit tag…", "Modifier le tag…"),
      removeTag: Orbit.tr("Remove tag", "Retirer le tag"),
      tagHint: Orbit.tr("Tag text", "Texte du tag"),
      refImage: Orbit.tr("Keep image on screen", "Garder l'image à l'écran"),
      refVideo: Orbit.tr("Keep video on screen", "Garder la vidéo à l'écran"),
      refLink: Orbit.tr("Keep link on screen", "Garder le lien à l'écran"),
      refPage: Orbit.tr("Keep page on screen", "Garder la page à l'écran"),
    }[k];
  },

  init() {
    this.initRename();
    this.initTags();
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
      if (!label || !tab || (tab.pinned && !OrbitKept.isKept(tab))) return;
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
    // Essentials tiles show no title: edit the name in a small popover instead.
    if (!box || !box.getBoundingClientRect().width) {
      return this.popover(tab, { value: tab.label, placeholder: this.t("rename"), onDone: v => this.setName(tab, v) });
    }
    if (tab.querySelector(".orbit-rename")) return;
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

  // Floating text field under a tab (essentials have no visible title).
  popover(tab, { value = "", placeholder = "", extra = null, onDone }) {
    document.getElementById("orbit-tab-popover")?.remove();
    const h = Orbit.h.bind(Orbit);
    const input = h("input", { class: "orbit-input", value, placeholder, maxlength: 80, "aria-label": placeholder });
    const pop = h("div", { id: "orbit-tab-popover", class: "orbit-ctx orbit-tab-popover" }, input, extra);
    document.body.append(pop);
    const r = tab.getBoundingClientRect();
    pop.style.left = `${Math.round(Math.max(8, r.left))}px`;
    pop.style.top = `${Math.round(r.bottom + 6)}px`;
    let done = false;
    const close = save => {
      if (done) return;
      done = true;
      window.removeEventListener("mousedown", outside, true);
      pop.remove();
      if (save) onDone(input.value.trim());
    };
    const outside = e => !pop.contains(e.target) && close(true);
    window.addEventListener("mousedown", outside, true);
    input.addEventListener("keydown", e => {
      e.stopPropagation();
      if (e.key == "Enter") close(true);
      else if (e.key == "Escape") close(false);
    });
    input.focus();
    input.select();
    return { pop, input, close };
  },

  // ---- tags: a colored label on a tab ("IMPORTANT" in yellow...) -------------------
  TAG_KEY: "orbit-tag",
  TAG_COLORS: ["#f5c518", "#ff5d5d", "#ff9f43", "#3ddc97", "#4f8cff", "#a66bff", "#ff6bcb", "#8a8a99"],
  TAG_PRESETS: [["IMPORTANT", "#f5c518", "star"], ["URGENT", "#ff5d5d", "flame"], ["À LIRE", "#4f8cff", "book-open"], ["TODO", "#3ddc97", "check"]],
  TAG_ICONS: ["", "star", "flame", "zap", "heart", "check", "bookmark", "briefcase", "code", "music", "book-open", "rocket"],

  initTags() {
    const restoreAll = () => {
      for (const tab of gBrowser.tabs) this.paintTag(tab);
    };
    window.addEventListener("SSWindowRestored", restoreAll);
    gBrowser.tabContainer.addEventListener("SSTabRestoring", e => this.paintTag(e.target));
    setTimeout(restoreAll, 0);
  },

  // A target is a tab or a folder (tab-group); folders keep their tag in OrbitFolders' data.
  getTag(tab) {
    if (!tab) return null;
    if (tab.localName == "tab-group") return OrbitFolders.meta[tab.id]?.tag ?? null;
    try {
      return JSON.parse(SessionStore.getCustomTabValue(tab, this.TAG_KEY) || "null");
    } catch {
      return null;
    }
  },

  setTag(tab, tag) {
    if (!tab) return;
    if (tab.localName == "tab-group") return OrbitFolders.setMeta(tab.id, { tag: tag?.text ? tag : null });
    if (tag?.text) SessionStore.setCustomTabValue(tab, this.TAG_KEY, JSON.stringify(tag));
    else SessionStore.deleteCustomTabValue(tab, this.TAG_KEY);
    this.paintTag(tab);
  },

  // Black or white text, whichever reads better on the tag color.
  ink(hex) {
    const n = parseInt(hex.slice(1), 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.6 ? "#111" : "#fff";
  },

  paintTag(tab) {
    const tag = this.getTag(tab);
    let pill = tab.querySelector(".orbit-tab-tag");
    if (!tag) {
      pill?.remove();
      tab.removeAttribute("orbit-tagged");
      return;
    }
    if (!pill) {
      pill = Orbit.h("span", { class: "orbit-tab-tag" });
      // Before the close button, so the × stays at the far right.
      const close = tab.querySelector(".tab-content > .tab-close-button");
      if (close) close.before(pill);
      else tab.querySelector(".tab-content")?.append(pill);
    }
    this.fillTag(pill, tag);
    tab.setAttribute("orbit-tagged", "true");
    tab.style.setProperty("--orbit-tag", tag.color);
  },

  // Text, color and an optional icon, drawn in the tag's ink color.
  fillTag(pill, tag) {
    const ink = this.ink(tag.color);
    pill.replaceChildren(...(tag.icon ? [Orbit.h("img", { class: "orbit-tag-icon", alt: "",
      src: `${Orbit.BASE}icons/${tag.icon}.svg`, style: `stroke: ${ink}` })] : []), tag.text);
    pill.style.background = tag.color;
    pill.style.color = ink;
  },

  // On every selected tab when the menu was opened on a selection.
  editTag(target) {
    if (!target) return;
    const targets = target.multiselected ? gBrowser.selectedTabs : [target];
    const anchor = target.localName == "tab-group" ? target.querySelector(".tab-group-label-container") ?? target : target;
    const h = Orbit.h.bind(Orbit);
    const cur = this.getTag(target) ?? { text: "", color: this.TAG_COLORS[0] };
    let color = cur.color;
    let icon = cur.icon ?? "";
    const apply = tag => { for (const t of targets) this.setTag(t, tag); };
    const swatches = h("div", { class: "orbit-tag-swatches" }, ...this.TAG_COLORS.map(c =>
      h("button", { class: "orbit-tag-swatch", style: `background:${c}`, active: c == color, title: c, onclick: e => {
        color = c;
        for (const b of swatches.children) b.toggleAttribute("active", b == e.currentTarget);
        ui.input.focus();
      } })));
    const icons = h("div", { class: "orbit-tag-icons" }, ...this.TAG_ICONS.map(name =>
      h("button", { class: "orbit-icon-button", title: name || "–", active: name == icon, onclick: e => {
        icon = name;
        for (const b of icons.children) b.toggleAttribute("active", b == e.currentTarget);
        ui.input.focus();
      } }, name ? Orbit.icon(name) : Orbit.icon("x"))));
    const presets = h("div", { class: "orbit-tag-presets" }, ...this.TAG_PRESETS.map(([text, c, ic]) => {
      const pill = h("button", { class: "orbit-tab-tag", onclick: () => {
        apply({ text, color: c, icon: ic });
        ui.close(false);
      } });
      this.fillTag(pill, { text, color: c, icon: ic });
      return pill;
    }));
    const ui = this.popover(anchor, {
      value: cur.text, placeholder: this.t("tagHint"),
      extra: h("div", { class: "orbit-tag-extra" }, swatches, icons, presets),
      onDone: v => apply(v ? { text: v.toUpperCase().slice(0, 18), color, icon: icon || null } : null),
    });
  },

  // An image, a video or a page in its own small window, always on top.
  reference(url, title = "", icon = "") {
    const w = 420;
    const hgt = 300;
    const left = screen.availLeft + screen.availWidth - w - 24;
    const top = screen.availTop + screen.availHeight - hgt - 24;
    const args = { url, title, icon };
    args.wrappedJSObject = args;
    window.openDialog(`${Orbit.BASE}orbit-ref.html`, "_blank",
      `chrome,dialog=no,alwaysontop,resizable,titlebar=no,width=${w},height=${hgt},left=${left},top=${top}`, args);
  },

  // ---- context menus -----------------------------------------------------------------
  initMenus() {
    const h = Orbit.h.bind(Orbit);
    const tabMenu = document.getElementById("tabContextMenu");
    // Tidy once every Orbit item exists (other modules add theirs at init).
    tabMenu?.addEventListener("popupshowing", e => e.target == tabMenu && this.organizeTabMenu(tabMenu), true);
    // Items other modules add later get their icon when a menu opens.
    for (const id of ["tabContextMenu", "contentAreaContextMenu"]) {
      document.getElementById(id)?.addEventListener("popupshowing", () => this.menuIcons(), true);
    }
    if (tabMenu) {
      const rename = h("xul:menuitem", { id: "orbit-tab-rename", label: this.t("rename"),
        oncommand: () => this.rename(TabContextMenu.contextTab) });
      const reset = h("xul:menuitem", { id: "orbit-tab-reset-name", label: this.t("resetName"),
        oncommand: () => this.setName(TabContextMenu.contextTab, "") });
      const tag = h("xul:menuitem", { id: "orbit-tab-tag", oncommand: () => this.editTag(TabContextMenu.contextTab) });
      const untag = h("xul:menuitem", { id: "orbit-tab-untag", label: this.t("removeTag"),
        oncommand: () => {
          const tab = TabContextMenu.contextTab;
          for (const t of tab.multiselected ? gBrowser.selectedTabs : [tab]) this.setTag(t, null);
        } });
      const copy = h("xul:menuitem", { id: "orbit-tab-copy", label: this.t("copy"),
        oncommand: () => this.copy(TabContextMenu.contextTab.linkedBrowser.currentURI.spec) });
      const sleepSpace = h("xul:menuitem", { id: "orbit-space-unload", label: this.t("unloadSpace"),
        oncommand: () => this.unloadSpace(OrbitSpaces.spaceOf(TabContextMenu.contextTab)) });
      const sleepOthers = h("xul:menuitem", { id: "orbit-space-unload-others", label: this.t("unloadOthers"),
        oncommand: () => this.unloadOtherSpaces() });
      const first = tabMenu.firstElementChild;
      tabMenu.insertBefore(rename, first);
      tabMenu.insertBefore(reset, first);
      tabMenu.insertBefore(tag, first);
      tabMenu.insertBefore(untag, first);
      tabMenu.insertBefore(copy, first);
      tabMenu.insertBefore(h("xul:menuseparator"), first);
      tabMenu.append(h("xul:menuseparator"), sleepSpace, sleepOthers);
      tabMenu.addEventListener("popupshowing", e => {
        if (e.target != tabMenu) return;
        const tab = TabContextMenu.contextTab;
        rename.hidden = !tab;
        tag.setAttribute("label", this.getTag(tab) ? this.t("editTag") : this.t("tag"));
        tag.hidden = !tab;
        untag.hidden = !this.getTag(tab);
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
      // "Keep on screen": a reference window above every other window.
      const ref = h("xul:menuitem", { id: "orbit-context-reference", oncommand: () => {
        const c = this._refCtx;
        if (c) this.reference(c.url, c.title, c.icon);
      } });
      linkMenu.insertBefore(ref, glance);
      linkMenu.addEventListener("popupshowing", e => {
        if (e.target != linkMenu) return;
        glance.hidden = !gContextMenu?.onLink || !/^https?:/.test(gContextMenu.linkURL ?? "") || !OrbitGlance.open;
        const c = gContextMenu;
        const media = c?.onImage ? ["refImage", c.imageInfo?.currentSrc || c.mediaURL] : c?.onVideo ? ["refVideo", c.mediaURL]
          : c?.onLink ? ["refLink", c.linkURL] : !c?.onTextInput && !c?.isTextSelected ? ["refPage", gBrowser.currentURI.spec] : null;
        const ok = media && /^(https?|file):/.test(media[1] ?? "");
        ref.hidden = !ok;
        if (ok) {
          ref.setAttribute("label", this.t(media[0]));
          this._refCtx = { url: media[1], title: media[0] == "refPage" ? gBrowser.selectedTab.label : "", icon: gBrowser.selectedTab.getAttribute("image") };
        }
      });
    }
  },

  // Icons on the native menus' main items, so every menu reads like Orbit's.
  MENU_ICONS: {
    context_openANewTab: "plus", context_reloadTab: "rotate-cw", context_reloadSelectedTabs: "rotate-cw",
    context_duplicateTab: "copy", context_duplicateTabs: "copy", context_toggleMuteTab: "volume-x",
    context_toggleMuteSelectedTabs: "volume-x", "orbit-tab-rename": "pencil", "orbit-tab-reset-name": "rotate-ccw",
    "orbit-tab-tag": "tag", "orbit-tab-untag": "x", "orbit-tab-copy": "link", "orbit-tab-keep": "pin",
    context_pinTab: "pin", context_unpinTab: "pin", context_pinSelectedTabs: "pin", context_unpinSelectedTabs: "pin",
    context_moveTabToNewGroup: "folder", context_moveTabToGroup: "folder", context_ungroupTab: "folder",
    context_moveTabToSplitView: "columns-2", "orbit-move-to-space": "layers", context_unloadTab: "moon",
    "orbit-space-unload": "moon", "orbit-space-unload-others": "moon", context_closeTab: "x", context_undoCloseTab: "rotate-ccw",
    "context-openlinkintab": "plus", "context-openlinkinusercontext-menu": "layers", "context-openlink": "app-window",
    "orbit-context-glance": "eye", "orbit-context-reference": "picture-in-picture-2", "context-copylink": "link",
    "context-bookmarklink": "bookmark", "context-savelink": "download", "context-copyimage-contents": "copy",
    "context-copyimage": "link", "context-saveimage": "download", "context-viewimage": "image", "context-copy": "copy",
    "context-cut": "copy", "context-paste": "copy", "context-viewsource": "code-xml", "context-inspect": "code",
    "context-take-screenshot": "camera", "context-savepage": "download", "context-searchselect": "search",
    "context-video-pictureinpicture": "picture-in-picture-2", "context-print-selection": "printer",
    "context-sendpagetodevice": "external-link", "context-selectall": "type",
  },

  menuIcons() {
    for (const [id, icon] of Object.entries(this.MENU_ICONS)) {
      const el = document.getElementById(id);
      if (!el || el.hasAttribute("orbit-icon")) continue;
      el.classList.add(el.localName == "menu" ? "menu-iconic" : "menuitem-iconic");
      el.setAttribute("image", `${Orbit.BASE}icons/${icon}.svg`);
      el.setAttribute("orbit-icon", "");
    }
  },

  // The tab menu, tidied: frequent actions first, the rest under "More".
  TAB_MENU: [
    ["context_openANewTab", "context_duplicateTab", "context_duplicateTabs", "context_reloadTab", "context_reloadSelectedTabs",
      "context_toggleMuteTab", "context_toggleMuteSelectedTabs", "context_playTab", "context_playSelectedTabs"],
    ["orbit-tab-rename", "orbit-tab-reset-name", "orbit-tab-tag", "orbit-tab-untag", "orbit-tab-copy", "orbit-tab-keep", "context_pinTab", "context_unpinTab",
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
