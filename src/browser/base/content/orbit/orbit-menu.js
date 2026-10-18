/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Orbit's own app menu (replaces the ≡ panel). Items run Firefox's existing
// <command>s, so shortcuts and behavior stay identical.
var OrbitMenu = {
  ITEMS: [
    { icon: "plus", fr: "Nouvel onglet", en: "New tab", key: "Ctrl+T", run: () => BrowserCommands.openTab() },
    { icon: "app-window", fr: "Nouvelle fenêtre", en: "New window", key: "Ctrl+N", cmd: "cmd_newNavigator" },
    { icon: "eye-off", fr: "Nouvelle fenêtre privée", en: "New private window", key: "Ctrl+Maj+P", cmd: "Tools:PrivateBrowsing" },
    "-",
    { icon: "bookmark", fr: "Marque-pages", en: "Bookmarks", key: "Ctrl+Maj+O", cmd: "Browser:ShowAllBookmarks" },
    { icon: "history", fr: "Historique", en: "History", key: "Ctrl+H", cmd: "Browser:ShowAllHistory" },
    { icon: "download", fr: "Téléchargements", en: "Downloads", key: "Ctrl+J", cmd: "Tools:Downloads" },
    { icon: "puzzle", fr: "Extensions et thèmes", en: "Extensions and themes", key: "Ctrl+Maj+A", cmd: "Tools:Addons" },
    { icon: "bot", fr: "Assistant IA", en: "AI assistant", key: "Ctrl+Maj+U", run: () => OrbitAI.toggleAssistant() },
    { icon: "search", fr: "Rechercher un onglet", en: "Search tabs", key: "Ctrl+Maj+Espace", run: () => OrbitTabs.openCommandBar("% ") },
    { icon: "gauge", fr: "Mémoire", en: "Memory", run: () => OrbitMemory.open() },
    "-",
    { kind: "zoom" },
    { icon: "search", fr: "Rechercher dans la page", en: "Find in page", key: "Ctrl+F", cmd: "cmd_find" },
    { icon: "printer", fr: "Imprimer…", en: "Print…", key: "Ctrl+P", cmd: "cmd_print" },
    "-",
    { icon: "settings-2", fr: "Paramètres", en: "Settings", key: "Ctrl+,", run: () => OrbitSettings.open() },
    { icon: "shield", fr: "Paramètres avancés", en: "Advanced settings", run: () => openPreferences() },
    { icon: "info", fr: "À propos d'Orbit", en: "About Orbit", run: () => OrbitSettings.open("about") },
    "-",
    { icon: "log-out", fr: "Quitter", en: "Quit", key: "Ctrl+Maj+Q", cmd: "cmd_quitApplication" },
  ],

  init() {
    const button = document.getElementById("PanelUI-menu-button");
    button?.addEventListener("mousedown", e => {
      if (e.button != 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.toggle(button);
    }, true);
    button?.addEventListener("command", e => e.stopImmediatePropagation(), true);
    button?.addEventListener("keypress", e => {
      if (e.key == "Enter" || e.key == " ") {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.toggle(button);
      }
    }, true);
  },

  toggle(anchor) {
    if (document.getElementById("orbit-menu")) return this.close();
    this.open(anchor);
  },

  open(anchor) {
    const h = Orbit.h.bind(Orbit);
    const lang = Orbit.lang();
    const run = item => {
      this.close();
      if (item.run) item.run();
      else document.getElementById(item.cmd)?.doCommand();
    };
    const menu = h("div", { id: "orbit-menu", role: "menu" },
      h("div", { class: "orbit-menu-header" },
        h("img", { src: "chrome://branding/content/icon64.png", alt: "" }),
        h("div", {}, h("b", {}, "Orbit"), h("span", {}, `Version ${Services.appinfo.version}`))));
    for (const item of this.ITEMS) {
      if (item == "-") {
        menu.append(h("div", { class: "orbit-menu-sep" }));
      } else if (item.kind == "zoom") {
        const pct = h("span", { class: "orbit-zoom-value" });
        const sync = () => (pct.textContent = `${Math.round(ZoomManager.zoom * 100)}%`);
        const zbtn = (icon, cmd) => h("button", {
          class: "orbit-icon-button", onclick: () => { document.getElementById(cmd)?.doCommand(); setTimeout(sync, 50); },
        }, Orbit.icon(icon));
        sync();
        menu.append(h("div", { class: "orbit-menu-zoom" },
          h("span", {}, lang == "fr" ? "Zoom" : "Zoom"),
          h("div", { class: "orbit-zoom-controls" },
            zbtn("zoom-out", "cmd_fullZoomReduce"),
            h("button", { class: "orbit-zoom-reset", onclick: () => { FullZoom.reset(); setTimeout(sync, 50); } }, pct),
            zbtn("zoom-in", "cmd_fullZoomEnlarge"))));
      } else {
        menu.append(h("button", { class: "orbit-menu-item", role: "menuitem", onclick: () => run(item) },
          Orbit.icon(item.icon), h("span", { class: "orbit-menu-label" }, item[lang]),
          item.key ? h("span", { class: "orbit-menu-key" }, lang == "fr" ? item.key : item.key.replace("Maj", "Shift")) : null));
      }
    }
    document.body.append(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.top = `${Math.round(r.bottom + 6)}px`;
    menu.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
    menu.querySelector(".orbit-menu-item")?.focus();
    anchor.setAttribute("open", "true");
    this.anchor = anchor;

    this._outside = e => !menu.contains(e.target) && !anchor.contains(e.target) && this.close();
    this._key = e => {
      if (e.key == "Escape") {
        e.preventDefault();
        this.close();
      } else if (e.key == "ArrowDown" || e.key == "ArrowUp") {
        e.preventDefault();
        const items = [...menu.querySelectorAll(".orbit-menu-item")];
        const i = items.indexOf(document.activeElement);
        items.at((i + (e.key == "ArrowDown" ? 1 : -1)) % items.length)?.focus();
      }
    };
    window.addEventListener("mousedown", this._outside, true);
    window.addEventListener("keydown", this._key, true);
    window.addEventListener("blur", this._blur = () => this.close(), { once: true });
  },

  close() {
    const menu = document.getElementById("orbit-menu");
    window.removeEventListener("mousedown", this._outside, true);
    window.removeEventListener("keydown", this._key, true);
    window.removeEventListener("blur", this._blur);
    this.anchor?.removeAttribute("open");
    if (!menu) return;
    menu.setAttribute("closing", "true");
    setTimeout(() => menu.remove(), 140);
  },
};
