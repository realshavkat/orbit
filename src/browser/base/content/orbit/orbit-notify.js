/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var OrbitNotify = {
  KINDS: ["pin", "default", "update", "sleep", "tips"],
  SNOOZE_DAYS: 30,

  S: {
    fr: {
      later: "Plus tard", never: "Ne plus demander", no: "Non merci",
      "pin.t": "Épingler Orbit à la barre des tâches ?", "pin.d": "Retrouve Orbit en un clic, à côté de tes applis.", "pin.b": "Épingler",
      "default.t": "Faire d'Orbit ton navigateur par défaut ?", "default.d": "Les liens de tes applis s'ouvriront dans Orbit.", "default.b": "Définir par défaut",
      "update.t": "Orbit est à jour", "update.d": "Version {v} installée ·", "update.b": "Nouveautés",
      "sleep.t": "{n} onglets mis en veille", "sleep.d": "Ils se rechargent dès que tu cliques dessus.",
      "tips.t": "Astuce",
      tips: ["Alt+clic sur un lien l'ouvre en aperçu.", "Ctrl+Maj+Espace cherche parmi tes onglets.",
        "Tape @claude suivi d'une question dans la barre d'adresse.", "Ctrl+Alt+C cache la barre latérale.",
        "Alt+1 à 9 passe d'un espace à l'autre.", "orbit://memoire montre la mémoire de chaque onglet."],
    },
    en: {
      later: "Later", never: "Don't ask again", no: "No thanks",
      "pin.t": "Pin Orbit to the taskbar?", "pin.d": "Get to Orbit in one click, next to your apps.", "pin.b": "Pin",
      "default.t": "Make Orbit your default browser?", "default.d": "Links from your apps will open in Orbit.", "default.b": "Set as default",
      "update.t": "Orbit is up to date", "update.d": "Version {v} installed ·", "update.b": "What's new",
      "sleep.t": "{n} tabs put to sleep", "sleep.d": "They reload as soon as you click them.",
      "tips.t": "Tip",
      tips: ["Alt+click a link to preview it.", "Ctrl+Shift+Space searches your tabs.",
        "Type @claude and a question in the address bar.", "Ctrl+Alt+C hides the sidebar.",
        "Alt+1 to 9 switches spaces.", "orbit://memory shows the memory of each tab."],
    },
  },

  t(k, vars = {}) {
    return (Orbit.dict(this.S)[k] ?? k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? "");
  },

  enabled(kind) {
    if (!Orbit.pref(`orbit.notify.${kind}`, kind != "tips")) return false;
    return Date.now() / 1000 > Orbit.pref(`orbit.notify.${kind}.snooze`, 0);
  },

  snooze(kind) {
    Services.prefs.setIntPref(`orbit.notify.${kind}.snooze`, Math.floor(Date.now() / 1000) + this.SNOOZE_DAYS * 86400);
  },

  init() {
    if ([...Services.wm.getEnumerator("navigator:browser")].length > 1) return;
    setTimeout(() => this.startupChecks().catch(e => console.error("Orbit notify", e)), 4000);
  },

  async startupChecks() {
    const p = Services.prefs;
    const launches = Orbit.pref("orbit.notify.launches", 0) + 1;
    p.setIntPref("orbit.notify.launches", launches);

    const version = Services.appinfo.version;
    const last = Orbit.pref("orbit.notify.last-version", "");
    p.setStringPref("orbit.notify.last-version", version);
    if (last && last != version && this.enabled("update")) {
      this.show({
        kind: "update", icon: "refresh-cw", tone: "ok", title: this.t("update.t"), text: this.t("update.d", { v: version }),
        link: { label: this.t("update.b"), run: () => openTrustedLinkIn("https://github.com/realshavkat/orbit/releases", "tab") },
        timeout: 9000,
      });
      return;
    }
    if (Orbit.pref("orbit.welcome.done", false) == false) return;
    const shell = window.getShellService?.();
    if (!shell) return;
    if (launches >= 2 && this.enabled("default") && !shell.isDefaultBrowser(false, false)) {
      this.show({
        kind: "default", icon: "circle-check", title: this.t("default.t"), text: this.t("default.d"),
        primary: { label: this.t("default.b"), run: () => shell.setDefaultBrowser(false) },
        secondary: { label: this.t("no"), run: () => this.snooze("default") },
        never: true,
      });
      return;
    }
    if (AppConstants.platform == "win" && launches >= 3 && this.enabled("pin") && (await shell.doesAppNeedPin())) {
      this.show({
        kind: "pin", icon: "pin", tone: "dark", title: this.t("pin.t"), text: this.t("pin.d"),
        primary: { label: this.t("pin.b"), run: () => shell.pinToTaskbar() },
        secondary: { label: this.t("later"), run: () => this.snooze("pin") },
        never: true,
      });
      return;
    }
    if (this.enabled("tips")) {
      const tips = Orbit.dict(this.S).tips;
      this.show({ kind: "tips", icon: "sparkles", title: this.t("tips.t"), text: tips[launches % tips.length], never: true, timeout: 8000 });
    }
  },

  tabsSlept(n) {
    if (this._sleptShown || !this.enabled("sleep")) return;
    this._sleptShown = true;
    this.show({ kind: "sleep", icon: "activity", tone: "warm", title: this.t("sleep.t", { n }), text: this.t("sleep.d"), timeout: 6000 });
  },

  show({ kind, icon, tone, title, text, link, primary, secondary, never, timeout }) {
    const h = Orbit.h.bind(Orbit);
    let stack = document.getElementById("orbit-toasts");
    if (!stack) document.body.append(stack = h("div", { id: "orbit-toasts" }));
    const close = () => {
      card.setAttribute("closing", "true");
      setTimeout(() => card.remove(), 200);
    };
    const actions = primary || secondary || never;
    const card = h("div", { class: "orbit-toast", "data-tone": tone ?? "", role: "status", compact: !actions },
      h("div", { class: "orbit-toast-main" },
        h("span", { class: "orbit-toast-icon" }, Orbit.icon(icon)),
        h("div", { class: "orbit-toast-text" }, h("b", {}, title),
          h("span", {}, text, link ? " " : null,
            link ? h("button", { class: "orbit-toast-link", onclick: () => { link.run(); close(); } }, link.label) : null)),
        actions ? h("button", { class: "orbit-toast-close", "aria-label": "Fermer", onclick: () => { this.snooze(kind); close(); } }, Orbit.icon("x")) : null),
      actions ? h("div", { class: "orbit-toast-actions" },
        primary ? h("button", { class: "orbit-toast-b1", onclick: () => { primary.run(); close(); } }, primary.label) : null,
        secondary ? h("button", { class: "orbit-toast-b2", onclick: () => { secondary.run(); close(); } }, secondary.label) : null,
        never ? h("button", { class: "orbit-toast-never", onclick: () => { Services.prefs.setBoolPref(`orbit.notify.${kind}`, false); close(); } }, this.t("never")) : null) : null);
    if (!actions) card.addEventListener("click", e => !e.target.closest("button") && close());
    stack.append(card);
    if (timeout) setTimeout(close, timeout);
  },
};
