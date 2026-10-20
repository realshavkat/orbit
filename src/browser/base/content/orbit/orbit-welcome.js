/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// First-run setup. Built to stay light on any PC: a static background, no
// blur or masks, and only one small demo animating at a time (transforms and
// opacity only). The window's own background is paused meanwhile.
var OrbitWelcome = {
  STEPS: ["hello", "look", "tour", "layout", "setup", "done"],

  maybeShow() {
    if (Orbit.pref("orbit.welcome.done", false) || PrivateBrowsingUtils.isWindowPrivate(window)) return;
    // Only the first window shows it.
    if (Services.wm.getMostRecentWindow("navigator:browser") != window) return;
    this.show();
  },

  // Feature tour: [icon, title, text, demo builder].
  FEATURES() {
    return [
      ["layers", Orbit.tr("Spaces and Essentials", "Espaces et favoris"),
        Orbit.tr("One space per project with its own colors. Your favorite sites stay as tiles at the top.", "Un espace par projet, avec ses couleurs. Tes sites préférés restent en tuiles tout en haut."), "spaces"],
      ["pin", Orbit.tr("Drag to pin", "Glisse pour épingler"),
        Orbit.tr("Drag a tab to the tiles, to the pinned rows or into a folder. A slot shows where it lands.", "Glisse un onglet vers les tuiles, les épinglés ou un dossier. Un emplacement montre où il atterrit."), "drag"],
      ["command", Orbit.tr("Command bar", "Barre de commande"),
        Orbit.tr("Ctrl+T opens a floating search: sites, tabs, settings and AI with @claude or @gpt.", "Ctrl+T ouvre une recherche flottante : sites, onglets, réglages et IA avec @claude ou @gpt."), "command"],
      ["eye", "Glance", Orbit.tr("Alt+click a link to preview it without leaving the page.", "Alt+clic sur un lien pour le prévisualiser sans quitter la page."), "glance"],
      ["shield-check", Orbit.tr("Private by default", "Privé par défaut"),
        Orbit.tr("Orbit Blocker stops ads and trackers, no telemetry is sent, and Orbit VPN hides your IP.", "Orbit Blocker bloque pubs et pisteurs, aucune télémétrie n'est envoyée, et Orbit VPN masque ton IP."), "shield"],
      ["gauge", Orbit.tr("Light on memory", "Léger en mémoire"),
        Orbit.tr("Tabs you don't use go to sleep and use almost nothing until you come back.", "Les onglets inutilisés se mettent en veille et ne consomment presque rien jusqu'à ton retour."), "sleep"],
      ["picture-in-picture-2", Orbit.tr("Keep it on screen", "Garde-le à l'écran"),
        Orbit.tr("Picture-in-Picture for videos, and any image or page as an always-on-top reference.", "Picture-in-Picture pour les vidéos, et n'importe quelle image ou page en référence toujours visible."), "ref"],
    ];
  },

  show() {
    const h = Orbit.h.bind(Orbit);
    let index = 0;
    const stage = h("div", { class: "ow-stage" });
    const dots = h("div", { class: "ow-dots" }, ...this.STEPS.map(() => h("span")));
    const back = h("button", { class: "ow-btn", onclick: () => go(index - 1) }, Orbit.tr("Back", "Retour"));
    const next = h("button", { class: "ow-btn primary", onclick: () => go(index + 1) });
    const root = h("div", { id: "orbit-welcome", class: "ow" },
      h("button", { class: "ow-skip", onclick: () => this.finish(root) }, Orbit.tr("Skip", "Passer")),
      stage,
      h("div", { class: "ow-nav" }, back, dots, next));
    document.documentElement.setAttribute("orbit-welcome-open", "true");

    const go = i => {
      if (i >= this.STEPS.length) return this.finish(root);
      if (i < 0) return;
      const dir = i > index ? 1 : -1;
      index = i;
      const old = stage.firstChild;
      this.stopTour();
      const page = h("div", { class: "ow-page" }, ...this.page(this.STEPS[i]));
      if (old && !window.gReduceMotion) {
        old.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateX(${-24 * dir}px)` }],
          { duration: 160, easing: "ease-in", fill: "forwards" }).finished.then(() => old.remove());
        page.animate([{ opacity: 0, transform: `translateX(${24 * dir}px)` }, { opacity: 1, transform: "none" }],
          { duration: 320, delay: 100, easing: "cubic-bezier(.2,.9,.25,1)", fill: "backwards" });
      } else {
        old?.remove();
      }
      stage.append(page);
      [...dots.children].forEach((d, j) => d.toggleAttribute("active", j == i));
      back.style.visibility = i == 0 || i == this.STEPS.length - 1 ? "hidden" : "visible";
      next.textContent = i == 0 ? Orbit.tr("Get started", "Commencer") : i == this.STEPS.length - 1
        ? Orbit.tr("Start browsing", "Commencer à naviguer") : Orbit.tr("Continue", "Continuer");
    };
    this._key = e => {
      if (e.key == "Escape") this.finish(root);
      else if (e.key == "Enter" && e.target.localName != "input") go(index + 1);
    };
    window.addEventListener("keydown", this._key, true);
    document.body.append(root);
    go(0);
    next.focus();
  },

  head(title, sub) {
    const h = Orbit.h.bind(Orbit);
    return [h("h1", {}, title), h("p", {}, sub)];
  },

  page(id) {
    const h = Orbit.h.bind(Orbit);
    const p = Services.prefs;
    switch (id) {
      case "hello":
        return [
          h("img", { class: "ow-logo", src: `${Orbit.BASE}orbit-logo.svg`, alt: "" }),
          ...this.head(Orbit.tr("Welcome to Orbit", "Bienvenue dans Orbit"),
            Orbit.tr("A calm, fast browser built on Firefox. No telemetry, ad blocking built in.",
              "Un navigateur calme et rapide, basé sur Firefox. Sans télémétrie, avec bloqueur intégré.")),
          h("input", {
            class: "ow-input", maxlength: 40, placeholder: Orbit.tr("Your first name (optional)", "Ton prénom (facultatif)"),
            value: Orbit.pref("orbit.user.name", ""), oninput: e => p.setStringPref("orbit.user.name", e.target.value.trim()),
          }),
        ];
      case "look": {
        const cur = () => Orbit.pref("browser.theme.toolbar-theme", 2);
        const cards = this.choices([[2, "p-system", Orbit.tr("System", "Système")], [1, "p-light", Orbit.tr("Light", "Clair")],
          [0, "p-dark", Orbit.tr("Dark", "Sombre")]], cur(), v => {
          p.setIntPref("browser.theme.toolbar-theme", v);
          p.setIntPref("browser.theme.content-theme", v);
        });
        const swatches = h("div", { class: "ow-swatches" },
          ...OrbitSpaces.THEMES.map(th => h("button", {
            class: "ow-swatch", style: `--c1:${th.c1};--c2:${th.c2}`, active: OrbitSpaces.active.theme == th.id, title: th.id,
            onclick: e => {
              OrbitSpaces.active.theme = th.id;
              OrbitSpaces.save();
              OrbitSpaces.update({ animate: false });
              for (const b of e.currentTarget.parentNode.children) b.toggleAttribute("active", b == e.currentTarget);
            },
          })));
        return [...this.head(Orbit.tr("Your look", "Ton style"), Orbit.tr("Everything can change later in Settings.", "Tout se change plus tard dans les paramètres.")),
          cards, h("div", { class: "ow-label" }, Orbit.tr("Space color", "Couleur de l'espace")), swatches];
      }
      case "tour":
        return [...this.head(Orbit.tr("What Orbit does for you", "Ce qu'Orbit fait pour toi"), ""), this.tour()];
      case "layout": {
        const mode = () => Orbit.pref("orbit.view.compact", false) ? "compact" : Orbit.pref("sidebar.position_start", true) ? "left" : "right";
        return [...this.head(Orbit.tr("Your layout", "Ta disposition"), Orbit.tr("Where do you want your tabs?", "Où veux-tu tes onglets ?")),
          this.choices([["left", "p-left", Orbit.tr("Left", "À gauche")], ["right", "p-right", Orbit.tr("Right", "À droite")],
            ["compact", "p-compact", Orbit.tr("Compact", "Compact")]], mode(), m => {
            p.setBoolPref("orbit.view.compact", m == "compact");
            p.setBoolPref("sidebar.position_start", m != "right");
          })];
      }
      case "setup": {
        const row = (icon, title, text, control) => h("div", { class: "ow-row" },
          h("span", { class: "ow-row-icon" }, Orbit.icon(icon)),
          h("div", {}, h("b", {}, title), h("small", {}, text)), control);
        const action = (label, run) => h("button", { class: "ow-btn small", onclick: e => {
          e.currentTarget.setAttribute("done", "true");
          run();
        } }, label);
        const updates = OrbitSettings.switch(true, on => OrbitUpdates.setAuto(on));
        OrbitUpdates.isAuto().then(on => !on && updates.click());
        return [...this.head(Orbit.tr("Make it yours", "Dernières touches"), Orbit.tr("All optional, all reversible.", "Tout est facultatif et réversible.")),
          h("div", { class: "ow-rows" },
            row("upload", Orbit.tr("Import from another browser", "Importer depuis un autre navigateur"),
              Orbit.tr("Bookmarks, passwords, history, from Chrome, Edge, Brave, Opera…", "Favoris, mots de passe, historique, depuis Chrome, Edge, Brave, Opera…"),
              action(Orbit.tr("Import", "Importer"), () => OrbitImport.open())),
            row("star", Orbit.tr("Default browser", "Navigateur par défaut"),
              Orbit.tr("Links from other apps open in Orbit.", "Les liens des autres applis s'ouvrent dans Orbit."),
              action(Orbit.tr("Set", "Définir"), () => { try { ShellService.setDefaultBrowser(false); } catch (err) { console.error(err); } })),
            row("shield", "Orbit Blocker", Orbit.tr("Blocks ads and trackers.", "Bloque pubs et pisteurs."),
              OrbitSettings.switch(true, async on => {
                const addon = await AddonManager.getAddonByID("orbit-blocker@orbit.app");
                if (addon) await (on ? addon.enable() : addon.disable());
              })),
            row("refresh-cw", Orbit.tr("Automatic updates", "Mises à jour automatiques"),
              Orbit.tr("Installed when Orbit restarts.", "Installées au redémarrage d'Orbit."), updates))];
      }
      case "done": {
        const name = Orbit.pref("orbit.user.name", "");
        return [h("div", { class: "ow-check" }, Orbit.icon("check")),
          ...this.head(name ? Orbit.tr("You're all set, {name}", "Tout est prêt, {name}").replace("{name}", name) : Orbit.tr("You're all set", "Tout est prêt"),
            Orbit.tr("A few shortcuts to get going:", "Quelques raccourcis pour bien démarrer :")),
          h("div", { class: "ow-keys" },
            ...[["Ctrl+T", Orbit.tr("Command bar", "Barre de commande")], ["Alt+Clic", "Glance"],
              ["Ctrl+Alt+C", Orbit.tr("Compact mode", "Mode compact")], ["Ctrl+,", Orbit.tr("Settings", "Paramètres")],
              ["Ctrl+W", Orbit.tr("Close the page (pins stay)", "Fermer la page (les épinglés restent)")],
              ["Ctrl+Maj+U", Orbit.tr("AI assistant", "Assistant IA")]].map(([k, l]) => h("div", {}, h("kbd", {}, k), h("span", {}, l))))];
      }
    }
    return [];
  },

  // Three big picture cards; `pick` runs on click.
  choices(options, current, pick) {
    const h = Orbit.h.bind(Orbit);
    const wrap = h("div", { class: "ow-choices" });
    for (const [v, cls, label] of options) {
      const card = h("button", { class: "ow-choice", active: v == current, onclick: () => {
        pick(v);
        for (const c of wrap.children) c.toggleAttribute("active", c == card);
      } }, h("span", { class: `ow-prev ${cls}` }, h("i"), h("b"), h("u")), h("span", {}, label));
      wrap.append(card);
    }
    return wrap;
  },

  // ---- feature tour: one demo at a time, auto-advancing --------------------------
  tour() {
    const h = Orbit.h.bind(Orbit);
    const features = this.FEATURES();
    const demo = h("div", { class: "ow-demo" });
    const text = h("div", { class: "ow-feature" });
    const list = h("div", { class: "ow-features" });
    let i = 0;
    const pick = n => {
      i = (n + features.length) % features.length;
      const [icon, title, desc, kind] = features[i];
      demo.replaceChildren(this.demo(kind));
      text.replaceChildren(h("b", {}, title), h("span", {}, desc));
      for (const [j, b] of [...list.children].entries()) b.toggleAttribute("active", j == i);
      clearTimeout(this._tour);
      this._tour = setTimeout(() => pick(i + 1), 5200);
    };
    features.forEach(([icon, title], j) => list.append(h("button", { class: "ow-feature-tab", onclick: () => pick(j) }, Orbit.icon(icon), h("span", {}, title))));
    pick(0);
    return h("div", { class: "ow-tour" }, list, h("div", { class: "ow-tour-main" }, demo, text));
  },

  stopTour() {
    clearTimeout(this._tour);
  },

  // Tiny looping scenes made of boxes: cheap to draw, easy to read.
  demo(kind) {
    const h = Orbit.h.bind(Orbit);
    const row = (cls = "") => h("i", { class: `d-row ${cls}` });
    const side = (...kids) => h("div", { class: "d-side" }, ...kids);
    switch (kind) {
      case "spaces":
        return h("div", { class: `d d-${kind}` }, side(h("div", { class: "d-tiles" }, h("i"), h("i"), h("i")), row("sel"), row(), row()),
          h("div", { class: "d-page" }), h("div", { class: "d-spaces" }, h("i", { class: "on" }), h("i"), h("i")));
      case "drag":
        return h("div", { class: `d d-${kind}` }, side(h("div", { class: "d-tiles" }, h("i"), h("i"), h("i", { class: "d-landing" })),
          h("i", { class: "d-row d-slot" }), row(), row(), row()), h("i", { class: "d-row d-moving" }), h("div", { class: "d-page" }));
      case "command":
        return h("div", { class: `d d-${kind}` }, side(row(), row(), row()), h("div", { class: "d-page" }),
          h("div", { class: "d-bar" }, h("i", { class: "d-type" }), h("i", { class: "d-res" }), h("i", { class: "d-res" }), h("i", { class: "d-res" })));
      case "glance":
        return h("div", { class: `d d-${kind}` }, side(row(), row(), row()), h("div", { class: "d-page" }, h("i", { class: "d-link" })),
          h("div", { class: "d-glance" }));
      case "shield":
        return h("div", { class: `d d-${kind}` }, h("div", { class: "d-shield" }, Orbit.icon("shield-check")),
          ...[1, 2, 3, 4, 5].map(n => h("i", { class: `d-ad d-ad${n}` })));
      case "sleep":
        return h("div", { class: `d d-${kind}` }, side(row("sel"), row("zz"), row("zz"), row("zz")),
          h("div", { class: "d-meter" }, h("i")));
      case "ref":
        return h("div", { class: `d d-${kind}` }, side(row(), row(), row()), h("div", { class: "d-page" }),
          h("div", { class: "d-float" }, h("i")));
    }
    return h("div");
  },

  finish(root) {
    Services.prefs.setBoolPref("orbit.welcome.done", true);
    this.stopTour();
    window.removeEventListener("keydown", this._key, true);
    document.documentElement.removeAttribute("orbit-welcome-open");
    root.setAttribute("closing", "true");
    setTimeout(() => root.remove(), 260);
  },
};
