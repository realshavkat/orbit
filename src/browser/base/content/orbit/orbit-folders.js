/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Folders: Gecko's tab groups with an icon, a tab count, sub-folders and
// pinning (a pinned folder is shown in every space and kept by "clear").
// Extra data per group lives in the orbit.folders pref: { id: {icon, parent, pinned} }.
var OrbitFolders = {
  PREF: "orbit.folders",
  ICONS: ["folder", "star", "briefcase", "code", "music", "film", "gamepad-2", "book-open", "graduation-cap", "heart",
    "rocket", "palette", "shopping-bag", "plane", "coffee", "leaf", "flame", "zap", "camera", "globe", "house", "user",
    "layers", "sparkles"],

  t(k) {
    const fr = Orbit.lang() == "fr";
    return {
      icon: Orbit.tr("Change icon…", "Changer l'icône…"),
      pin: Orbit.tr("Pin folder", "Épingler le dossier"),
      unpin: Orbit.tr("Unpin folder", "Désépingler le dossier"),
      sub: Orbit.tr("New sub-folder", "Nouveau sous-dossier"),
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
      // A timer, not requestAnimationFrame: rAF stalls while the window is hidden.
      if (this._timer) return;
      this._timer = setTimeout(() => {
        this._timer = 0;
        this.decorateAll();
      }, 0);
    };
    for (const type of ["TabGroupCreate", "TabGroupUpdate", "TabGrouped", "TabUngrouped", "TabOpen", "TabClose",
      "SSTabRestored", "TabGroupCollapse", "TabGroupExpand"]) {
      tc.addEventListener(type, schedule);
    }
    tc.addEventListener("TabGroupRemoved", e => {
      const id = e.target.id;
      // A group that is gone takes its Orbit data with it; its sub-folders move up.
      const all = this.meta;
      for (const [k, v] of Object.entries(all)) if (v.parent == id) all[k].parent = all[id]?.parent;
      delete all[id];
      Services.prefs.setStringPref(this.PREF, JSON.stringify(all));
    });
    Services.prefs.addObserver(this.PREF, schedule);
    window.addEventListener("unload", () => Services.prefs.removeObserver(this.PREF, schedule), { once: true });
    this.extendEditor();
    schedule();
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
        // Design: chevron, then the folder's icon if it has one, else a color dot.
        let chevron = box.querySelector(".orbit-folder-chevron");
        if (!chevron) {
          chevron = Orbit.icon("chevron-down", "orbit-icon orbit-folder-chevron");
          box.prepend(chevron, Orbit.h("span", { class: "orbit-folder-dot" }), Orbit.icon("folder", "orbit-icon orbit-folder-icon"));
        }
        const img = box.querySelector(".orbit-folder-icon");
        img.hidden = !this.ICONS.includes(m.icon);
        box.querySelector(".orbit-folder-dot").hidden = !img.hidden;
        if (!img.hidden) img.src = `${Orbit.BASE}icons/${m.icon}.svg`;
        label.dataset.count = String(group.tabs.length);
      }
      group.toggleAttribute("orbit-pinned", !!m.pinned);
      group.style.setProperty("--orbit-folder-depth", String(this.depth(group.id, meta)));
      // A collapsed parent hides its sub-folders.
      let hidden = false;
      for (let p = m.parent; p && !hidden; p = meta[p]?.parent) hidden = !!byId.get(p)?.collapsed;
      group.toggleAttribute("orbit-folder-hidden", hidden);
    }
  },

  // Extra buttons in Gecko's folder editor panel.
  extendEditor() {
    const editor = gBrowser.tabGroupMenu;
    const panel = editor?.panel ?? editor?.querySelector("panel");
    if (!panel) return;
    const h = Orbit.h.bind(Orbit);
    const btn = (id, onclick) => h("xul:toolbarbutton", { id, class: "subviewbutton", tabindex: "0", oncommand: onclick });
    const iconBtn = btn("orbit-folder-icon-btn", () => this.pickIcon(editor.activeGroup));
    const pinBtn = btn("orbit-folder-pin-btn", () => this.togglePin(editor.activeGroup));
    const subBtn = btn("orbit-folder-sub-btn", () => this.addSubFolder(editor.activeGroup));
    panel.addEventListener("popupshowing", () => {
      const actions = panel.querySelector(".tab-group-edit-actions");
      if (actions && !iconBtn.isConnected) actions.prepend(iconBtn, pinBtn, subBtn, h("xul:toolbarseparator"));
      const pinned = !!this.meta[editor.activeGroup?.id]?.pinned;
      iconBtn.setAttribute("label", this.t("icon"));
      pinBtn.setAttribute("label", pinned ? this.t("unpin") : this.t("pin"));
      subBtn.setAttribute("label", this.t("sub"));
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
    const pinned = !this.meta[group.id]?.pinned;
    this.setMeta(group.id, { pinned });
    // Pinned folders sit at the top of the list.
    if (pinned) {
      const first = gBrowser.tabContainer.ariaFocusableItems?.find?.(el => !el.pinned) ?? gBrowser.visibleTabs.find(t => !t.pinned);
      const target = first?.group ?? first;
      if (target && target != group) gBrowser.moveTabBefore(group, target);
    }
    OrbitSpaces.syncVisibility();
  },

  // shortcut: a sub-folder is placed right after its parent but does not follow it
  // when the parent is dragged elsewhere; upgrade if nested folders get heavy use.
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
};
