/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Edit mode: right-click the sidebar, "Modifier Orbit". A panel lists the
// toolbar's buttons (remove, reorder by dragging them in the toolbar) and
// every button that can be added, Orbit's own included (AI assistant, keep on
// screen...), plus the sidebar's layout. Built on CustomizableUI, so it persists.
var OrbitEdit = {
  AREA: "nav-bar",
  // Buttons worth offering in the tray (extensions' buttons are always offered).
  OFFER: ["home-button", "history-panelmenu", "bookmarks-menu-button", "downloads-button", "library-button",
    "screenshot-button", "fullscreen-button", "zoom-controls", "print-button", "new-window-button",
    "privatebrowsing-button", "find-button", "panic-button", "developer-button", "save-page-button",
    "open-file-button", "preferences-button", "alltabs-button", "new-tab-button", "edit-controls",
    "unified-extensions-button", "orbit-ai-button", "orbit-ref-button", "orbit-picker-button", "orbit-vpn-button"],
  // Lucide icon per known button (palette nodes are detached: no computed icon).
  ICONS: { "home-button": "house", "history-panelmenu": "history", "bookmarks-menu-button": "bookmark", "downloads-button": "download",
    "library-button": "book-open", "screenshot-button": "camera", "fullscreen-button": "maximize-2", "zoom-controls": "zoom-in",
    "print-button": "printer", "new-window-button": "app-window", "privatebrowsing-button": "eye-off", "find-button": "search",
    "panic-button": "flame", "developer-button": "code-xml", "save-page-button": "download", "open-file-button": "upload",
    "preferences-button": "settings-2", "alltabs-button": "layers", "new-tab-button": "plus", "edit-controls": "copy",
    "unified-extensions-button": "puzzle", "orbit-ai-button": "bot", "orbit-ref-button": "picture-in-picture-2", "orbit-picker-button": "pipette",
    "orbit-vpn-button": "shield", "urlbar-container": "search", "back-button": "arrow-left", "forward-button": "arrow-right",
    "stop-reload-button": "rotate-cw", "sidebar-button": "panel-left" },
  FIXED: new Set(["urlbar-container", "sidebar-button", "back-button", "forward-button", "stop-reload-button"]),

  t(k) {
    const fr = Orbit.lang() == "fr";
    return {
      edit: Orbit.tr("Edit Orbit", "Modifier Orbit"),
      newSpace: Orbit.tr("New space", "Nouvel espace"),
      compact: Orbit.tr("Compact mode", "Mode compact"),
      side: Orbit.tr("Sidebar on the right", "Barre latérale à droite"),
      layout: Orbit.tr("Layout settings", "Paramètres de disposition"),
      title: Orbit.tr("Edit mode", "Mode édition"),
      hint: Orbit.tr("Drag toolbar buttons to reorder them, × to remove one.", "Glisse les boutons de la barre pour les réordonner, × pour en retirer."),
      add: Orbit.tr("Add", "Ajouter"),
      none: Orbit.tr("Every button is already in the toolbar.", "Tous les boutons sont déjà dans la barre."),
      done: Orbit.tr("Done", "Terminé"),
      reset: Orbit.tr("Reset", "Réinitialiser"),
      left: Orbit.tr("Left", "Gauche"), right: Orbit.tr("Right", "Droite"),
      tabs: Orbit.tr("Tabs", "Onglets"),
      width: Orbit.tr("Width", "Largeur"),
      remove: Orbit.tr("Remove", "Retirer"),
      toolbar: Orbit.tr("Toolbar", "Barre d'outils"),
      sidebar: Orbit.tr("Sidebar", "Barre latérale"),
      inBar: Orbit.tr("In the toolbar", "Dans la barre"),
      available: Orbit.tr("Available buttons", "Boutons disponibles"),
      position: Orbit.tr("Position", "Position"),
      ai: Orbit.tr("AI assistant", "Assistant IA"),
      ref: Orbit.tr("Keep page on screen", "Garder la page à l'écran"),
    }[k];
  },

  BLOCKER_WIDGET: "orbit-blocker_orbit_app-browser-action",

  init() {
    this.placeBlocker();
    this.createWidgets();
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

  // Orbit's own buttons, offered in the edit panel (app-wide: the first window
  // creates them, the others get "already exists").
  createWidgets() {
    const make = (id, label, run) => {
      try {
        CustomizableUI.createWidget({ id, type: "button", label, tooltiptext: label,
          onCommand: e => run(e.target.ownerDocument.defaultView) });
      } catch {}
    };
    make("orbit-ai-button", this.t("ai"), win => win.OrbitAI.toggleAssistant());
    make("orbit-picker-button", Orbit.tr("Color picker", "Pipette à couleurs"), win => win.OrbitPicker.start());
    make("orbit-ref-button", this.t("ref"), win =>
      win.OrbitExtras.reference(win.gBrowser.currentURI.spec, win.gBrowser.selectedTab.label, win.gBrowser.selectedTab.getAttribute("image")));
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
    return ContextualIdentityService.getPublicIdentities().map(identity => {
      const name = ContextualIdentityService.getUserContextLabel(identity.userContextId);
      const el = item("circle-dot", name, () => {
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
        class: "orbit-ext-pin orbit-icon-button", title: Orbit.tr("Pin to toolbar", "Épingler à la barre d'outils"),
        onclick: e => {
          e.stopPropagation();
          gUnifiedExtensions.pinToToolbar(item.id, true);
          gUnifiedExtensions.togglePanel?.();
        },
      }, Orbit.icon("pin"));
      item.append(pin);
    }
  },

  // Orbit's sidebar menu, sorted in sections: create, this space, display,
  // then Orbit itself. Toggles show their state; containers open a submenu.
  menu(_sx, _sy, x, y) {
    document.getElementById("orbit-ctx")?.remove();
    const h = Orbit.h.bind(Orbit);
    const p = Services.prefs;
    const item = (icon, label, run, { key = "", checked = null } = {}) => h("button", {
      class: "orbit-menu-item", role: checked == null ? "menuitem" : "menuitemcheckbox", "aria-checked": checked == null ? null : String(checked),
      onclick: () => { close(); run(); },
    }, Orbit.icon(icon), h("span", { class: "orbit-menu-label" }, label),
    checked != null ? h("span", { class: "orbit-menu-check", on: checked }) : key ? h("span", { class: "orbit-menu-key" }, key) : null);
    const section = label => h("div", { class: "orbit-menu-section" }, label);
    const sep = () => h("div", { class: "orbit-menu-sep" });
    const space = OrbitSpaces.active;
    const containers = this.containerItems(item);
    const sub = containers.length ? h("div", { class: "orbit-ctx orbit-ctx-sub", role: "menu" }, ...containers) : null;
    const containerMenu = sub && h("div", { class: "orbit-menu-item orbit-menu-parent", role: "menuitem", tabindex: 0, "aria-haspopup": "true" },
      Orbit.icon("layers"), h("span", { class: "orbit-menu-label" }, Orbit.tr("Tab in a container", "Onglet dans un conteneur")),
      Orbit.icon("chevron-right", "orbit-icon orbit-menu-more"), sub);
    const menu = h("div", { id: "orbit-ctx", class: "orbit-ctx", role: "menu" },
      section(Orbit.tr("New", "Créer")),
      item("plus", Orbit.tr("New tab", "Nouvel onglet"), () => OrbitTabs.openCommandBar(), { key: "Ctrl T" }),
      item("folder", OrbitFolders.t("newFolder"), () => {
        const tab = OrbitSpaces.openTab();
        gBrowser.addTabGroup([tab], { label: OrbitFolders.t("newFolder") });
      }),
      item("layers", this.t("newSpace"), () => OrbitSpaces.edit(null)),
      containerMenu,
      sep(),
      section(space?.name ?? ""),
      item("palette", Orbit.tr("Quick colors", "Couleurs rapides"), () => OrbitColors.open(document.getElementById("orbit-space-title"))),
      item("pencil", Orbit.tr("Edit space", "Modifier l'espace"), () => OrbitSpaces.edit(space)),
      item("moon", Orbit.tr("Put space to sleep", "Mettre l'espace en veille"), () => OrbitExtras.unloadSpace(OrbitSpaces.activeId)),
      sep(),
      section(Orbit.tr("Display", "Affichage")),
      item("panel-left", this.t("compact"), () => OrbitLayout.toggleCompact(), { checked: Orbit.pref("orbit.view.compact", false) }),
      item("columns-2", this.t("side"), () => p.setBoolPref("sidebar.position_start", !Orbit.pref("sidebar.position_start", true)),
        { checked: !Orbit.pref("sidebar.position_start", true) }),
      sep(),
      item("wand-sparkles", this.t("edit"), () => this.enter()),
      item("settings-2", Orbit.tr("Settings", "Paramètres"), () => OrbitSettings.open(), { key: "Ctrl ," }));
    document.body.append(menu);
    menu.style.left = `${Math.min(x, innerWidth - menu.offsetWidth - 8)}px`;
    menu.style.top = `${Math.min(y, innerHeight - menu.offsetHeight - 8)}px`;
    // The submenu opens on the side with room.
    if (sub) {
      const r = menu.getBoundingClientRect();
      sub.toggleAttribute("left", r.right + 240 > innerWidth);
    }
    const items = () => [...menu.querySelectorAll(":scope > .orbit-menu-item")];
    const close = () => {
      menu.remove();
      window.removeEventListener("mousedown", outside, true);
      window.removeEventListener("keydown", key, true);
    };
    const outside = e => !menu.contains(e.target) && close();
    const key = e => {
      if (e.key == "Escape") return close();
      // Arrow keys move through the items, like a native menu.
      const list = items();
      const i = list.indexOf(document.activeElement);
      if (e.key == "ArrowDown" || e.key == "ArrowUp") {
        e.preventDefault();
        list[(i + (e.key == "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
      }
    };
    window.addEventListener("mousedown", outside, true);
    window.addEventListener("keydown", key, true);
    items()[0]?.focus();
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
    this.current = h("div", { class: "orbit-edit-current" });
    this.tray = h("div", { class: "orbit-edit-tray" });
    const panes = {
      toolbar: h("div", { class: "orbit-edit-pane" },
        h("div", { class: "orbit-edit-label" }, this.t("inBar")), this.current,
        h("div", { class: "orbit-edit-label" }, this.t("available")), this.tray),
      sidebar: h("div", { class: "orbit-edit-pane", hidden: true },
        h("div", { class: "orbit-card" },
          OrbitSettings.row(OrbitSettings.segmented([[true, this.t("left")], [false, this.t("right")]], Orbit.pref("sidebar.position_start", true),
            v => Services.prefs.setBoolPref("sidebar.position_start", v)), "sidebarRight"),
          OrbitSettings.row(OrbitSettings.switch(Orbit.pref("orbit.view.compact", false), on => Services.prefs.setBoolPref("orbit.view.compact", on)), "compact"),
          OrbitSettings.row(OrbitSettings.slider({ min: 180, max: 480, unit: "px", value: Orbit.pref("orbit.view.sidebar-width", 240),
            onInput: v => Services.prefs.setIntPref("orbit.view.sidebar-width", v) }), "sidebarWidth"))),
    };
    // The position row reads "Left / Right", so its label is the plain word.
    panes.sidebar.querySelector(".orbit-setting-label").textContent = this.t("position");
    const tabs = OrbitSettings.segmented([["toolbar", this.t("toolbar")], ["sidebar", this.t("sidebar")]], "toolbar", v => {
      panes.toolbar.hidden = v != "toolbar";
      panes.sidebar.hidden = v != "sidebar";
    });
    this.bar = h("div", { id: "orbit-edit-bar", role: "dialog", "aria-label": this.t("title") },
      h("div", { class: "orbit-edit-head" },
        h("span", { class: "orbit-edit-icon" }, Orbit.icon("pencil")),
        h("div", {}, h("b", {}, this.t("edit")), h("span", {}, this.t("hint"))),
        h("button", { class: "orbit-button", onclick: () => { CustomizableUI.reset(); this.refresh(); } }, this.t("reset")),
        h("button", { class: "orbit-button primary", onclick: () => this.exit() }, this.t("done"))),
      tabs, panes.toolbar, panes.sidebar);
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

  iconFor(id, node) {
    const name = this.ICONS[id];
    if (name) return Orbit.icon(name);
    const img = node?.getAttribute?.("image");
    return img ? Orbit.h("img", { class: "orbit-icon", src: img, alt: "" }) : Orbit.icon("puzzle");
  },

  refresh() {
    if (!this.active) return;
    const h = Orbit.h.bind(Orbit);
    document.querySelectorAll(".orbit-edit-x").forEach(x => x.remove());
    const current = [];
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
      const removable = !this.FIXED.has(id) && CustomizableUI.isWidgetRemovable(id);
      const remove = () => {
        CustomizableUI.removeWidgetFromArea(id);
        this.refresh();
      };
      if (removable) {
        node.append(h("button", { class: "orbit-edit-x", title: this.t("remove"), onclick: e => { e.stopPropagation(); remove(); } }, Orbit.icon("x")));
      }
      const label = h("span", {}, id);
      const named = { "urlbar-container": Orbit.tr("Address bar", "Barre d'adresse"), "stop-reload-button": Orbit.tr("Reload", "Actualiser") }[id];
      this.label(CustomizableUI.getWidget(id)).then(l => (label.textContent = named ?? l));
      current.push(h("div", { class: "orbit-edit-item", fixed: !removable }, this.iconFor(id, node), label,
        removable ? h("button", { class: "orbit-icon-button", title: this.t("remove"), onclick: remove }, Orbit.icon("x")) : null));
    }
    this.current.replaceChildren(...current);
    const unused = CustomizableUI.getUnusedWidgets(gNavToolbox.palette)
      .filter(w => this.OFFER.includes(w.id) || w.id.endsWith("-browser-action"));
    const cards = unused.map(w => {
      const label = h("span", {}, w.id);
      this.label(w).then(l => (label.textContent = l));
      const node = w.forWindow?.(window)?.node;
      return h("button", {
        class: "orbit-edit-card", onclick: () => { CustomizableUI.addWidgetToArea(w.id, this.AREA); this.refresh(); },
      }, h("span", { class: "orbit-edit-card-icon" }, this.iconFor(w.id, node)), label, Orbit.icon("plus", "orbit-icon orbit-edit-plus"));
    });
    this.tray.replaceChildren(...(cards.length ? cards : [h("span", { class: "orbit-setting-desc" }, this.t("none"))]));
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
