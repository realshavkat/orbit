/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Edit mode: right-click the sidebar, "Modifier Orbit". Toolbar buttons can
// be dragged to reorder, removed with ×, added back from a tray, and the
// layout switched in place. Built on CustomizableUI, so it persists.
var OrbitEdit = {
  AREA: "nav-bar",
  // Buttons worth offering in the tray (extensions' buttons are always offered).
  OFFER: ["home-button", "history-panelmenu", "bookmarks-menu-button", "downloads-button", "library-button",
    "screenshot-button", "fullscreen-button", "zoom-controls", "print-button", "new-window-button",
    "privatebrowsing-button", "find-button", "panic-button", "developer-button", "save-page-button",
    "open-file-button", "preferences-button", "alltabs-button", "new-tab-button", "edit-controls",
    "ipprotection-button", "unified-extensions-button"],
  FIXED: new Set(["urlbar-container", "sidebar-button", "back-button", "forward-button", "stop-reload-button"]),

  t(k) {
    const fr = Orbit.lang() == "fr";
    return {
      edit: fr ? "Modifier Orbit" : "Edit Orbit",
      newSpace: fr ? "Nouvel espace" : "New space",
      compact: fr ? "Mode compact" : "Compact mode",
      side: fr ? "Barre latérale à droite" : "Sidebar on the right",
      layout: fr ? "Paramètres de disposition" : "Layout settings",
      title: fr ? "Mode édition" : "Edit mode",
      hint: fr ? "Glisse les boutons de la barre pour les réordonner, × pour en retirer." : "Drag toolbar buttons to reorder them, × to remove one.",
      add: fr ? "Ajouter" : "Add",
      none: fr ? "Tous les boutons sont déjà dans la barre." : "Every button is already in the toolbar.",
      done: fr ? "Terminé" : "Done",
      reset: fr ? "Réinitialiser" : "Reset",
      left: fr ? "Gauche" : "Left", right: fr ? "Droite" : "Right",
      tabs: fr ? "Onglets" : "Tabs",
      width: fr ? "Largeur" : "Width",
      remove: fr ? "Retirer" : "Remove",
    }[k];
  },

  BLOCKER_WIDGET: "orbit-blocker_orbit_app-browser-action",

  init() {
    this.placeBlocker();
    // Extensions panel: a pin button on each extension puts it in the toolbar.
    document.addEventListener("ViewShowing", e => {
      if (e.target.id == "unified-extensions-view") setTimeout(() => this.decorateExtensions(e.target), 0);
    }, true);
    document.getElementById("sidebar-container")?.addEventListener("contextmenu", e => {
      if (e.target.closest?.(".tabbrowser-tab, tab-group, .tab-group-label, #pinned-drop-indicator")) return;
      e.preventDefault();
      e.stopPropagation();
      this.menu(e.screenX, e.screenY, e.clientX, e.clientY);
    }, true);
  },

  // Orbit Blocker's shield goes in the toolbar once; after that it is the user's.
  placeBlocker() {
    if (Orbit.pref("orbit.blocker.placed", false)) return;
    const place = () => {
      if (Orbit.pref("orbit.blocker.placed", false) || !CustomizableUI.getWidget(this.BLOCKER_WIDGET)?.provider) return false;
      const ids = CustomizableUI.getWidgetIdsInArea(CustomizableUI.AREA_NAVBAR);
      const at = ids.indexOf("unified-extensions-button");
      CustomizableUI.addWidgetToArea(this.BLOCKER_WIDGET, CustomizableUI.AREA_NAVBAR, at < 0 ? undefined : at);
      Services.prefs.setBoolPref("orbit.blocker.placed", true);
      return true;
    };
    if (place()) return;
    const listener = { onWidgetCreated: id => id == this.BLOCKER_WIDGET && place() && CustomizableUI.removeListener(listener) };
    CustomizableUI.addListener(listener);
    window.addEventListener("unload", () => CustomizableUI.removeListener(listener), { once: true });
  },

  // "New container tab" entries, one per container, with its color.
  containerItems(item) {
    if (!Orbit.pref("privacy.userContext.enabled", false)) return [];
    const fr = Orbit.lang() == "fr";
    return ContextualIdentityService.getPublicIdentities().map(identity => {
      const name = ContextualIdentityService.getUserContextLabel(identity.userContextId);
      const el = item("plus", `${fr ? "Onglet" : "Tab"} ${name}`, () => {
        const tab = gBrowser.addTrustedTab(OrbitTabs.homeURL(), { userContextId: identity.userContextId, inBackground: false });
        OrbitSpaces.setTabSpace(tab, OrbitSpaces.activeId);
      });
      el.classList.add("orbit-ctx-container", `identity-color-${identity.color}`);
      return el;
    });
  },

  decorateExtensions(view) {
    const fr = Orbit.lang() == "fr";
    for (const item of view.querySelectorAll(".unified-extensions-item")) {
      if (item.querySelector(".orbit-ext-pin") || !CustomizableUI.getPlacementOfWidget(item.id)) continue;
      const pin = Orbit.h("button", {
        class: "orbit-ext-pin orbit-icon-button", title: fr ? "Épingler à la barre d'outils" : "Pin to toolbar",
        onclick: e => {
          e.stopPropagation();
          gUnifiedExtensions.pinToToolbar(item.id, true);
          gUnifiedExtensions.togglePanel?.();
        },
      }, Orbit.icon("pin"));
      item.append(pin);
    }
  },

  // Small Orbit-styled context menu at the pointer.
  menu(_sx, _sy, x, y) {
    document.getElementById("orbit-ctx")?.remove();
    const h = Orbit.h.bind(Orbit);
    const item = (icon, label, run) => h("button", {
      class: "orbit-menu-item", role: "menuitem",
      onclick: () => { close(); run(); },
    }, Orbit.icon(icon), h("span", { class: "orbit-menu-label" }, label));
    const menu = h("div", { id: "orbit-ctx", class: "orbit-ctx", role: "menu" },
      item("pencil", this.t("edit"), () => this.enter()),
      h("div", { class: "orbit-menu-sep" }),
      item("plus", this.t("newSpace"), () => OrbitSpaces.edit(null)),
      item("folder", OrbitFolders.t("newFolder"), () => {
        const tab = OrbitSpaces.openTab();
        gBrowser.addTabGroup([tab], { label: OrbitFolders.t("newFolder") });
      }),
      ...this.containerItems(item),
      item("panel-left", this.t("compact"), () => OrbitLayout.toggleCompact()),
      item("columns-2", this.t("side"), () => Services.prefs.setBoolPref("sidebar.position_start", !Orbit.pref("sidebar.position_start", true))),
      item("settings-2", this.t("layout"), () => OrbitSettings.open("layout")));
    document.body.append(menu);
    menu.style.left = `${Math.min(x, innerWidth - menu.offsetWidth - 8)}px`;
    menu.style.top = `${Math.min(y, innerHeight - menu.offsetHeight - 8)}px`;
    const close = () => {
      menu.remove();
      window.removeEventListener("mousedown", outside, true);
      window.removeEventListener("keydown", key, true);
    };
    const outside = e => !menu.contains(e.target) && close();
    const key = e => e.key == "Escape" && close();
    window.addEventListener("mousedown", outside, true);
    window.addEventListener("keydown", key, true);
    menu.querySelector("button").focus();
  },

  // ---- edit mode ------------------------------------------------------------------
  items() {
    return CustomizableUI.getWidgetIdsInArea(this.AREA).filter(id => document.getElementById(id));
  },

  enter() {
    if (this.active) return;
    this.active = true;
    OrbitSettings.close?.(true);
    document.documentElement.setAttribute("orbit-editing", "true");
    const h = Orbit.h.bind(Orbit);
    this.tray = h("div", { class: "orbit-edit-tray" });
    this.bar = h("div", { id: "orbit-edit-bar", role: "dialog", "aria-label": this.t("title") },
      h("div", { class: "orbit-edit-head" },
        h("div", {}, h("b", {}, this.t("title")), h("span", {}, this.t("hint"))),
        h("button", { class: "orbit-toast-b2", onclick: () => { CustomizableUI.reset(); this.refresh(); } }, this.t("reset")),
        h("button", { class: "orbit-toast-b1", onclick: () => this.exit() }, this.t("done"))),
      h("div", { class: "orbit-edit-row" },
        h("span", { class: "orbit-sheet-kicker" }, this.t("tabs").toUpperCase()),
        OrbitSettings.segmented([[true, this.t("left")], [false, this.t("right")]], Orbit.pref("sidebar.position_start", true),
          v => Services.prefs.setBoolPref("sidebar.position_start", v)),
        h("span", { class: "orbit-sheet-kicker" }, this.t("compact").toUpperCase()),
        OrbitSettings.switch(Orbit.pref("orbit.view.compact", false), on => Services.prefs.setBoolPref("orbit.view.compact", on)),
        h("span", { class: "orbit-sheet-kicker" }, this.t("width").toUpperCase()),
        OrbitSettings.slider({ min: 180, max: 480, unit: "px", value: Orbit.pref("orbit.view.sidebar-width", 240),
          onInput: v => Services.prefs.setIntPref("orbit.view.sidebar-width", v) })),
      h("div", { class: "orbit-edit-row" }, h("span", { class: "orbit-sheet-kicker" }, this.t("add").toUpperCase()), this.tray));
    document.body.append(this.bar);

    this._click = e => {
      if (e.target.closest?.(".orbit-edit-x")) return;
      if (e.target.closest?.(`#${this.AREA}`) && !e.target.closest(".titlebar-buttonbox-container")) {
        // mousedown must keep its default action or dragging would not start.
        if (e.type != "mousedown") e.preventDefault();
        e.stopPropagation();
      }
    };
    for (const type of ["click", "command", "mousedown"]) window.addEventListener(type, this._click, true);
    this._key = e => e.key == "Escape" && this.exit();
    window.addEventListener("keydown", this._key, true);
    this.refresh();
  },

  refresh() {
    if (!this.active) return;
    const h = Orbit.h.bind(Orbit);
    document.querySelectorAll(".orbit-edit-x").forEach(x => x.remove());
    for (const id of this.items()) {
      if (/spring|spacer|separator/.test(id)) continue;
      const node = document.getElementById(id);
      node.setAttribute("draggable", "true");
      node.setAttribute("orbit-edit-item", "true");
      node.ondragstart = e => {
        e.dataTransfer.setData("text/x-orbit-widget", id);
        e.dataTransfer.effectAllowed = "move";
      };
      node.ondragover = e => {
        if (!e.dataTransfer.types.includes("text/x-orbit-widget")) return;
        e.preventDefault();
        node.setAttribute("orbit-drop-before", "true");
      };
      node.ondragleave = () => node.removeAttribute("orbit-drop-before");
      node.ondrop = e => {
        node.removeAttribute("orbit-drop-before");
        const dragged = e.dataTransfer.getData("text/x-orbit-widget");
        if (!dragged || dragged == id) return;
        e.preventDefault();
        const ids = this.items();
        let to = ids.indexOf(id);
        if (ids.indexOf(dragged) < to) to--;
        CustomizableUI.moveWidgetWithinArea(dragged, Math.max(0, to));
        this.refresh();
      };
      if (!this.FIXED.has(id) && CustomizableUI.isWidgetRemovable(id)) {
        node.append(h("button", {
          class: "orbit-edit-x", title: this.t("remove"),
          onclick: e => {
            e.stopPropagation();
            CustomizableUI.removeWidgetFromArea(id);
            this.refresh();
          },
        }, Orbit.icon("x")));
      }
    }
    const unused = CustomizableUI.getUnusedWidgets(gNavToolbox.palette)
      .filter(w => this.OFFER.includes(w.id) || w.id.endsWith("-browser-action"));
    const chips = unused.map(w => {
      const label = h("span", {}, w.id);
      this.label(w).then(l => (label.textContent = l));
      return h("button", {
        class: "orbit-edit-chip", onclick: () => { CustomizableUI.addWidgetToArea(w.id, this.AREA); this.refresh(); },
      }, Orbit.icon("plus"), label);
    });
    this.tray.replaceChildren(...(chips.length ? chips : [h("span", { class: "orbit-setting-desc" }, this.t("none"))]));
  },

  // A palette widget's localized name.
  async label(w) {
    const node = w.forWindow?.(window)?.node ?? gNavToolbox.palette.querySelector(`#${CSS.escape(w.id)}`);
    const direct = node?.getAttribute("label") || node?.getAttribute("tooltiptext") || w.label;
    if (direct) return direct;
    const l10nId = node?.getAttribute("data-l10n-id") ?? w.l10nId;
    if (l10nId) {
      const [msg] = await document.l10n.formatMessages([{ id: l10nId }]);
      const attr = msg?.attributes?.find(a => a.name == "label" || a.name == "tooltiptext");
      if (attr?.value || msg?.value) return attr?.value || msg.value;
    }
    return w.id.replace(/-button$/, "").replace(/-/g, " ");
  },

  exit() {
    if (!this.active) return;
    this.active = false;
    document.documentElement.removeAttribute("orbit-editing");
    for (const type of ["click", "command", "mousedown"]) window.removeEventListener(type, this._click, true);
    window.removeEventListener("keydown", this._key, true);
    document.querySelectorAll(".orbit-edit-x").forEach(x => x.remove());
    document.querySelectorAll("[orbit-edit-item]").forEach(n => {
      n.removeAttribute("draggable");
      n.removeAttribute("orbit-edit-item");
      n.ondragstart = n.ondragover = n.ondragleave = n.ondrop = null;
    });
    this.bar?.remove();
  },
};
