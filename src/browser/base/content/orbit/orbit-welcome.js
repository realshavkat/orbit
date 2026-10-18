/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// First-run setup: a short animated walkthrough (style, layout, import).
var OrbitWelcome = {
  S: {
    fr: {
      skip: "Passer", next: "Continuer", back: "Retour", start: "Commencer",
      "hello.t": "Bienvenue dans Orbit", "hello.s": "Un navigateur calme, rapide et beau.", name: "Ton prénom (facultatif)",
      "style.t": "Choisis ton style", "style.s": "Tu pourras tout changer plus tard dans les paramètres.",
      dark: "Sombre", light: "Clair", system: "Système",
      "layout.t": "Ta disposition", "layout.s": "Où veux-tu tes onglets ?",
      left: "À gauche", right: "À droite", compact: "Compact",
      "import.t": "Retrouve tes affaires", "import.s": "Marque-pages, mots de passe et historique.",
      import: "Importer depuis un autre navigateur", "default": "Définir Orbit par défaut",
      "done.t": "Tout est prêt", "done.s": "Quelques raccourcis pour bien démarrer :",
      k1: "Nouvel onglet / barre de commande", k2: "Aperçu d'un lien (Glance)",
      k3: "Mode compact", k4: "Paramètres", go: "Commencer à naviguer",
    },
    en: {
      skip: "Skip", next: "Continue", back: "Back", start: "Get started",
      "hello.t": "Welcome to Orbit", "hello.s": "A calm, fast and beautiful browser.", name: "Your first name (optional)",
      "style.t": "Pick your style", "style.s": "You can change everything later in Settings.",
      dark: "Dark", light: "Light", system: "System",
      "layout.t": "Your layout", "layout.s": "Where do you want your tabs?",
      left: "Left", right: "Right", compact: "Compact",
      "import.t": "Bring your stuff", "import.s": "Bookmarks, passwords and history.",
      import: "Import from another browser", "default": "Make Orbit the default browser",
      "done.t": "You're all set", "done.s": "A few shortcuts to get going:",
      k1: "New tab / command bar", k2: "Preview a link (Glance)",
      k3: "Compact mode", k4: "Settings", go: "Start browsing",
    },
  },

  t(k) {
    return this.S[Orbit.lang()][k] ?? k;
  },

  maybeShow() {
    if (Orbit.pref("orbit.welcome.done", false) || PrivateBrowsingUtils.isWindowPrivate(window)) return;
    // Only the first window shows it.
    if (Services.wm.getMostRecentWindow("navigator:browser") != window) return;
    this.show();
  },

  show() {
    const h = Orbit.h.bind(Orbit);
    const steps = ["hello", "style", "layout", "import", "done"];
    let index = 0;
    const stage = h("div", { class: "orbit-welcome-stage" });
    const dots = h("div", { class: "orbit-welcome-dots" }, ...steps.map(() => h("span", {})));
    const back = h("button", { class: "orbit-button orbit-welcome-back", onclick: () => go(index - 1) }, this.t("back"));
    const next = h("button", { class: "orbit-button primary orbit-welcome-next", onclick: () => go(index + 1) });
    const root = h("div", { id: "orbit-welcome" },
      h("div", { class: "orbit-welcome-sky" }),
      h("button", { class: "orbit-welcome-skip", onclick: () => this.finish(root) }, this.t("skip")),
      stage,
      h("div", { class: "orbit-welcome-nav" }, back, dots, next));

    const go = i => {
      if (i >= steps.length) return this.finish(root);
      if (i < 0) return;
      const dir = i > index ? 1 : -1;
      index = i;
      const old = stage.firstChild;
      const page = this.page(steps[i]);
      page.classList.add("orbit-welcome-page");
      if (old && !window.gReduceMotion) {
        old.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateX(${-40 * dir}px)` }],
          { duration: 220, easing: "ease-in", fill: "forwards" }).finished.then(() => old.remove());
        page.animate([{ opacity: 0, transform: `translateX(${40 * dir}px)` }, { opacity: 1, transform: "none" }],
          { duration: 420, delay: 120, easing: "cubic-bezier(.2,.9,.25,1)", fill: "backwards" });
      } else {
        old?.remove();
      }
      stage.append(page);
      [...dots.children].forEach((d, j) => d.toggleAttribute("active", j == i));
      back.style.visibility = i == 0 || i == steps.length - 1 ? "hidden" : "visible";
      next.textContent = i == 0 ? this.t("start") : i == steps.length - 1 ? this.t("go") : this.t("next");
    };
    document.body.append(root);
    go(0);
    next.focus();
  },

  // Option cards that write a pref when picked.
  cards(options) {
    const h = Orbit.h.bind(Orbit);
    const wrap = h("div", { class: "orbit-welcome-cards" });
    for (const o of options) {
      const card = h("button", {
        class: "orbit-welcome-card", active: o.active(),
        onclick: () => {
          o.pick();
          for (const c of wrap.children) c.toggleAttribute("active", c == card);
        },
      }, h("div", { class: `orbit-welcome-preview ${o.preview}` }, h("i"), h("b"), h("u")), h("span", {}, o.label));
      wrap.append(card);
    }
    return wrap;
  },

  page(id) {
    const h = Orbit.h.bind(Orbit);
    const p = Services.prefs;
    const title = h("h1", {}, this.t(`${id}.t`));
    const sub = h("p", {}, this.t(`${id}.s`));
    switch (id) {
      case "hello":
        return h("div", {},
          h("div", { class: "orbit-welcome-logo" },
            h("div", { class: "orbit-welcome-ring" }),
            h("img", { src: `${Orbit.BASE}orbit-logo.svg`, alt: "" })),
          title, sub,
          h("input", {
            class: "orbit-welcome-name", maxlength: 40, placeholder: this.t("name"), value: Orbit.pref("orbit.user.name", ""),
            oninput: e => p.setStringPref("orbit.user.name", e.target.value.trim()),
          }));
      case "style": {
        const scheme = () => Orbit.pref("browser.theme.toolbar-theme", 0);
        const swatches = h("div", { class: "orbit-welcome-swatches" },
          ...OrbitSpaces.THEMES.map(th => h("button", {
            class: "orbit-pick-theme", style: `--c1:${th.c1};--c2:${th.c2}`, active: OrbitSpaces.active.theme == th.id,
            onclick: e => {
              OrbitSpaces.active.theme = th.id;
              OrbitSpaces.save();
              OrbitSpaces.update({ animate: false });
              for (const b of e.currentTarget.parentNode.children) b.toggleAttribute("active", b == e.currentTarget);
            },
          })));
        return h("div", {}, title, sub,
          this.cards([0, 1, 2].map(v => ({
            label: this.t(["dark", "light", "system"][v]), preview: ["p-dark", "p-light", "p-system"][v],
            active: () => scheme() == v, pick: () => p.setIntPref("browser.theme.toolbar-theme", v),
          }))),
          swatches);
      }
      case "layout": {
        const mode = () => Orbit.pref("orbit.view.compact", false) ? "compact"
          : Orbit.pref("sidebar.position_start", true) ? "left" : "right";
        const set = m => {
          p.setBoolPref("orbit.view.compact", m == "compact");
          p.setBoolPref("sidebar.position_start", m != "right");
        };
        return h("div", {}, title, sub, this.cards(["left", "right", "compact"].map(m => ({
          label: this.t(m), preview: `p-${m}`, active: () => mode() == m, pick: () => set(m),
        }))));
      }
      case "import": {
        const done = btn => btn.setAttribute("done", "true");
        return h("div", {}, title, sub,
          h("div", { class: "orbit-welcome-actions" },
            h("button", { class: "orbit-welcome-action", onclick: e => {
              done(e.currentTarget);
              MigrationUtils.showMigrationWizard(window, {});
            } }, Orbit.icon("upload"), h("span", {}, this.t("import")), Orbit.icon("check", "orbit-icon orbit-done")),
            h("button", { class: "orbit-welcome-action", onclick: e => {
              done(e.currentTarget);
              try {
                ShellService.setDefaultBrowser(false);
              } catch (err) {
                console.error(err);
              }
            } }, Orbit.icon("star"), h("span", {}, this.t("default")), Orbit.icon("check", "orbit-icon orbit-done"))));
      }
      case "done":
        return h("div", {}, title, sub,
          h("div", { class: "orbit-welcome-keys" },
            ...[["Ctrl+T", "k1"], ["Alt+Clic", "k2"], ["Ctrl+Alt+C", "k3"], ["Ctrl+,", "k4"]].map(([k, l]) =>
              h("div", {}, h("kbd", {}, k), h("span", {}, this.t(l))))));
    }
    return h("div");
  },

  finish(root) {
    Services.prefs.setBoolPref("orbit.welcome.done", true);
    root.setAttribute("closing", "true");
    setTimeout(() => root.remove(), 450);
  },
};
