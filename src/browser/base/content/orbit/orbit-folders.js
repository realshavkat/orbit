/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var OrbitFolders = {
  PREF: "orbit.folders",
  ICONS: ["folder", "star", "briefcase", "code", "music", "film", "gamepad-2", "book-open", "graduation-cap", "heart",
    "rocket", "palette", "shopping-bag", "plane", "coffee", "leaf", "flame", "zap", "camera", "globe", "house", "user",
    "layers", "sparkles"],

  t(k) {
    const fr = Orbit.lang() == "fr";
    return {
      icon: Orbit.tr("Change icon…", "Changer l'icône…"),
      pin: Orbit.tr("Pin folder in this space", "Épingler le dossier dans l'espace"),
      unpin: Orbit.tr("Unpin folder", "Désépingler le dossier"),
      sub: Orbit.tr("New sub-folder", "Nouveau sous-dossier"),
      tag: Orbit.tr("Add a tag…", "Ajouter un tag…"),
      unload: Orbit.tr("Put all tabs to sleep", "Mettre tous les onglets en veille"),
      collapseAll: Orbit.tr("Collapse all folders", "Replier tous les dossiers"),
      expandAll: Orbit.tr("Expand all folders", "Déplier tous les dossiers"),
      subName: Orbit.tr("Sub-folder", "Sous-dossier"),
      newFolder: Orbit.tr("New folder", "Nouveau dossier"),
    }[k];
  },

  get meta() {
    try {
      return JSON.parse(Orbit.pref(this.PREF, "{}")) || {};
    } catch {
      return {};
    }
  },

  setMeta(id, patch) {
    const all = this.meta;
    all[id] = { ...all[id], ...patch };
    for (const [k, v] of Object.entries(all[id])) if (v == null || v === false) delete all[id][k];
    if (!Object.keys(all[id]).length) delete all[id];
    Services.prefs.setStringPref(this.PREF, JSON.stringify(all));
  },

  groups() {
    return [...gBrowser.tabContainer.querySelectorAll("tab-group")];
  },

  init() {
    const tc = gBrowser.tabContainer;
    const schedule = () => {
      if (this._timer) return;
      this._timer = setTimeout(() => {
        this._timer = 0;
        this.decorateAll();
      }, 0);
    };
    for (const type of ["TabGroupCreate", "TabGroupUpdate", "TabGrouped", "TabUngrouped", "TabOpen", "TabClose",
      "SSTabRestored", "TabGroupCollapse", "TabGroupExpand", "TabAttrModified"]) {
      tc.addEventListener(type, schedule);
    }
    tc.addEventListener("TabGroupRemoved", e => {
      const id = e.target.id;
      const all = this.meta;
      for (const [k, v] of Object.entries(all)) if (v.parent == id) all[k].parent = all[id]?.parent;
      delete all[id];
      Services.prefs.setStringPref(this.PREF, JSON.stringify(all));
    });
    tc.addEventListener("click", e => {
      const box = e.target.closest?.(".tab-group-label-container");
      if (!box || e.button != 0 || e.ctrlKey || e.shiftKey || e.metaKey) return;
      if (e.target.classList.contains("tab-group-label") || e.target.closest(".orbit-folder-tag")) return;
      const group = box.closest("tab-group");
      if (!group) return;
      e.preventDefault();
      this.toggle(group);
    });
    Services.prefs.addObserver(this.PREF, schedule);
    window.addEventListener("unload", () => Services.prefs.removeObserver(this.PREF, schedule), { once: true });
    this.extendEditor();
    schedule();
  },

  foldItems(group) {
    const meta = this.meta;
    const children = this.groups().filter(g => meta[g.id]?.parent == group.id && !g.hasAttribute("orbit-folder-hidden"));
    return [...group.querySelectorAll(":scope > .tabbrowser-tab:not([visuallyselected], [multiselected]), :scope > tab-split-view-wrapper:not([hasactivetab])"), ...children];
  },

  async toggle(group) {
    if (this._folding?.has(group)) return;
    const vertical = gBrowser.tabContainer.verticalMode;
    if (window.gReduceMotion || !vertical) {
      group.collapsed = !group.collapsed;
      return;
    }
    (this._folding ??= new Set()).add(group);
    const fold = (el, from, to) => el.animate(
      [{ height: `${from}px`, minHeight: "0px", opacity: from ? 1 : 0, overflow: "clip" }, { height: `${to}px`, minHeight: "0px", opacity: to ? 1 : 0, overflow: "clip" }],
      { duration: 180, easing: "ease-in-out" }).finished.catch(() => {});
    try {
      if (group.collapsed) {
        group.collapsed = false;
        const items = this.foldItems(group);
        await Promise.all(items.map(el => fold(el, 0, el.getBoundingClientRect().height)));
      } else {
        const items = this.foldItems(group);
        await Promise.all(items.map(el => fold(el, el.getBoundingClientRect().height, 0).then(() => (el.style.height = "0px"))));
        group.collapsed = true;
        for (const el of items) el.style.removeProperty("height");
      }
    } finally {
      this._folding.delete(group);
    }
  },

  setAllCollapsed(collapsed) {
    for (const group of this.groups()) if (group.collapsed != collapsed && !group.hasAttribute("orbit-folder-hidden")) this.toggle(group);
  },

  unloadAll(group) {
    gBrowser.explicitUnloadTabs(group.tabs.filter(t => !t.selected && t.linkedPanel && !t.hasAttribute("pending")));
  },

  depth(id, meta = this.meta) {
    let d = 0;
    for (let p = meta[id]?.parent; p && d < 6; p = meta[p]?.parent) d++;
    return d;
  },

  decorateAll() {
    const meta = this.meta;
    const byId = new Map(this.groups().map(g => [g.id, g]));
    for (const group of byId.values()) {
      const m = meta[group.id] ?? {};
      const label = group.querySelector(".tab-group-label");
      const box = label?.parentNode;
      if (box) {
        box.querySelectorAll(".orbit-folder-dot, .orbit-folder-icon, :scope > .orbit-folder-chevron:first-child").forEach(el => el.remove());
        if (!box.querySelector(".orbit-folder-tile")) {
          box.prepend(Orbit.h("span", { class: "orbit-folder-tile" }, Orbit.h("img", { class: "orbit-icon", alt: "" })));
          box.append(Orbit.h("span", { class: "orbit-folder-meta" }), Orbit.icon("chevron-down", "orbit-icon orbit-folder-chevron"));
        }
        const name = this.ICONS.includes(m.icon) && m.icon != "folder" ? m.icon : group.collapsed ? "folder" : "folder-open";
        box.querySelector(".orbit-folder-tile img").src = `${Orbit.BASE}icons/${name}.svg`;
        const metaEl = box.querySelector(".orbit-folder-meta");
        const faces = group.collapsed ? group.tabs.slice(0, 3).map(t => t.getAttribute("image")).filter(Boolean) : [];
        metaEl.replaceChildren(...faces.map(src => Orbit.h("img", { class: "orbit-folder-face", src, alt: "" })),
          Orbit.h("span", { class: "orbit-folder-count" }, String(group.tabs.length)));
      }
      group.toggleAttribute("orbit-pinned", !!m.pinned);
      this.paintTag(group, m.tag);
      group.style.setProperty("--orbit-folder-depth", String(this.depth(group.id, meta)));
      let hidden = false;
      for (let p = m.parent; p && !hidden; p = meta[p]?.parent) hidden = !!byId.get(p)?.collapsed;
      group.toggleAttribute("orbit-folder-hidden", hidden);
    }
    this.placeHeader();
  },

  placeHeader() {
    const header = document.getElementById("orbit-sidebar-header");
    const newTab = document.getElementById("tabs-newtab-button");
    const list = document.getElementById("tabbrowser-arrowscrollbox");
    if (!header || !newTab || !list) return;
    const pinned = this.groups().filter(g => g.hasAttribute("orbit-pinned") && g.tabs.some(t => !t.hidden) &&
      !g.hasAttribute("orbit-folder-hidden"));
    const last = pinned.at(-1);
    document.documentElement.toggleAttribute("orbit-has-pinned-folders", !!last);
    const moved = Orbit.pref("sidebar.verticalTabs", true) ? [header, newTab] : [header];
    if (last) {
      if (last.nextElementSibling != header) last.after(...moved);
    } else if (header.parentNode == list) {
      list.before(...moved);
    }
  },

  paintTag(group, tag) {
    const box = group.querySelector(".tab-group-label-hover-highlight");
    let pill = box?.querySelector(".orbit-folder-tag");
    if (!tag?.text) return pill?.remove();
    if (!box) return;
    if (!pill) {
      pill = Orbit.h("span", { class: "orbit-tab-tag orbit-folder-tag" });
      box.querySelector(".tab-group-label")?.after(pill);
    }
    OrbitExtras.fillTag(pill, tag);
  },

  extendEditor() {
    const editor = gBrowser.tabGroupMenu;
    const panel = editor?.panel ?? editor?.querySelector("panel");
    if (!panel) return;
    const h = Orbit.h.bind(Orbit);
    const btn = (id, onclick) => h("xul:toolbarbutton", { id, class: "subviewbutton", tabindex: "0", oncommand: onclick });
    const iconBtn = btn("orbit-folder-icon-btn", () => this.pickIcon(editor.activeGroup));
    const pinBtn = btn("orbit-folder-pin-btn", () => this.togglePin(editor.activeGroup));
    const subBtn = btn("orbit-folder-sub-btn", () => this.addSubFolder(editor.activeGroup));
    const hide = () => gBrowser.tabGroupMenu.panel?.hidePopup?.();
    const unloadBtn = btn("orbit-folder-unload-btn", () => (hide(), this.unloadAll(editor.activeGroup)));
    const collapseBtn = btn("orbit-folder-collapse-all-btn", () => (hide(), this.setAllCollapsed(true)));
    const expandBtn = btn("orbit-folder-expand-all-btn", () => (hide(), this.setAllCollapsed(false)));
    const tagBtn = btn("orbit-folder-tag-btn", () => {
      const group = editor.activeGroup;
      gBrowser.tabGroupMenu.panel?.hidePopup?.();
      OrbitExtras.editTag(group);
    });
    panel.addEventListener("popupshowing", () => {
      const actions = panel.querySelector(".tab-group-edit-actions");
      if (actions && !iconBtn.isConnected) actions.prepend(iconBtn, tagBtn, pinBtn, subBtn, h("xul:toolbarseparator"), unloadBtn, collapseBtn, expandBtn, h("xul:toolbarseparator"));
      const pinned = !!this.meta[editor.activeGroup?.id]?.pinned;
      iconBtn.setAttribute("label", this.t("icon"));
      pinBtn.setAttribute("label", pinned ? this.t("unpin") : this.t("pin"));
      subBtn.setAttribute("label", this.t("sub"));
      unloadBtn.setAttribute("label", this.t("unload"));
      collapseBtn.setAttribute("label", this.t("collapseAll"));
      expandBtn.setAttribute("label", this.t("expandAll"));
      unloadBtn.disabled = !editor.activeGroup?.tabs.some(t => !t.selected && t.linkedPanel && !t.hasAttribute("pending"));
      tagBtn.setAttribute("label", this.meta[editor.activeGroup?.id]?.tag ? OrbitExtras.t("editTag") : this.t("tag"));
    });
  },

  pickIcon(group) {
    if (!group) return;
    gBrowser.tabGroupMenu.panel?.hidePopup?.();
    document.getElementById("orbit-icon-picker")?.remove();
    const h = Orbit.h.bind(Orbit);
    const label = group.querySelector(".tab-group-label");
    const r = (label ?? group).getBoundingClientRect();
    const current = this.meta[group.id]?.icon ?? "folder";
    const picker = h("div", { id: "orbit-icon-picker", class: "orbit-ctx", role: "listbox" },
      ...this.ICONS.map(name => h("button", {
        class: "orbit-icon-button", title: name, active: name == current,
        onclick: () => {
          this.setMeta(group.id, { icon: name == "folder" ? null : name });
          close();
        },
      }, Orbit.icon(name))));
    document.body.append(picker);
    picker.style.left = `${Math.round(r.left)}px`;
    picker.style.top = `${Math.round(r.bottom + 4)}px`;
    const close = () => {
      picker.remove();
      window.removeEventListener("mousedown", outside, true);
    };
    const outside = e => !picker.contains(e.target) && close();
    window.addEventListener("mousedown", outside, true);
  },

  togglePin(group) {
    if (!group) return;
    const pinned = this.meta[group.id]?.pinned ? null : OrbitSpaces.spaceOf(group.tabs[0]) || OrbitSpaces.activeId;
    this.setMeta(group.id, { pinned });
    if (pinned) {
      const first = gBrowser.tabContainer.ariaFocusableItems?.find?.(el => !el.pinned) ?? gBrowser.visibleTabs.find(t => !t.pinned);
      const target = first?.group ?? first;
      if (target && target != group) gBrowser.moveTabBefore(group, target);
    }
    OrbitSpaces.syncVisibility();
  },

  addSubFolder(parent) {
    if (!parent) return;
    gBrowser.tabGroupMenu.panel?.hidePopup?.();
    const tab = gBrowser.addTrustedTab(OrbitTabs.homeURL(), { inBackground: false });
    OrbitSpaces.setTabSpace(tab, OrbitSpaces.spaceOf(parent.tabs[0]) || OrbitSpaces.activeId);
    const after = parent.nextElementSibling;
    const group = gBrowser.addTabGroup([tab], { label: this.t("subName"), color: parent.color, insertBefore: after });
    this.setMeta(group.id, { parent: parent.id });
    if (parent.collapsed) parent.collapsed = false;
  },

  isPinnedTab(tab) {
    return !!tab.group && !!this.meta[tab.group.id]?.pinned;
  },

  isEverywhere(tab) {
    return !!tab.group && this.meta[tab.group.id]?.pinned === true;
  },
};
