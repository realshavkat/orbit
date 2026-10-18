/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Orbit settings sheet (gear in the sidebar, Ctrl+, or orbit://settings).
// Every control is a custom widget writing a pref; OrbitLayout.applyPrefs()
// turns prefs into live CSS in every window, so nothing needs a restart
// except the UI language.
var OrbitSettings = {
  FONTS: ["Outfit", "Inter", "Manrope", "Space Grotesk", "DM Sans", "Segoe UI Variable Text"],

  SECTIONS: [
    {
      id: "general", icon: "settings-2",
      items: [
        { kind: "language" },
        { kind: "font" },
        { kind: "choice", pref: "browser.theme.toolbar-theme", label: "scheme",
          options: [[0, "scheme.dark"], [1, "scheme.light"], [2, "scheme.system"]] },
      ],
    },
    {
      id: "look", icon: "palette",
      items: [
        { kind: "spacecolors" },
        { kind: "range", pref: "orbit.theme.intensity", label: "intensity", min: 0, max: 80, unit: "%" },
        { kind: "range", pref: "orbit.theme.radius", label: "radius", min: 0, max: 14, unit: "px" },
      ],
    },
    {
      id: "effects", icon: "sparkles",
      items: [
        { kind: "toggle", pref: "orbit.effects.glass", label: "glass", def: false },
        { kind: "toggle", pref: "orbit.effects.nebula", label: "nebula" },
        { kind: "toggle", pref: "orbit.effects.grain", label: "grain" },
        { kind: "toggle", pref: "orbit.effects.animations", label: "animations" },
      ],
    },
    {
      id: "layout", icon: "panel-left",
      items: [
        { kind: "toggle", pref: "orbit.view.compact", label: "compact", def: false },
        { kind: "toggle", pref: "sidebar.position_start", label: "sidebarRight", invert: true },
        { kind: "range", pref: "orbit.view.sidebar-width", label: "sidebarWidth", min: 180, max: 480, unit: "px" },
        { kind: "range", pref: "orbit.view.gap", label: "gap", min: 0, max: 20, unit: "px" },
      ],
    },
    {
      id: "browsing", icon: "globe",
      items: [
        { kind: "toggle", pref: "orbit.urlbar.replace-newtab", label: "commandbar" },
        { kind: "toggle", pref: "orbit.glance.enabled", label: "glance" },
        { kind: "choice", pref: "orbit.tabs.unload-after-minutes", label: "unload",
          options: [[0, "unload.never"], [10, "10 min"], [20, "20 min"], [60, "1 h"]] },
        { kind: "link", label: "advanced", icon: "external-link", action: () => openPreferences() },
        { kind: "link", label: "import", icon: "upload", action: () => MigrationUtils.showMigrationWizard(window, {}) },
      ],
    },
    { id: "about", icon: "info", items: [{ kind: "about" }] },
  ],

  t(key) {
    return (this.STRINGS[Orbit.lang()] ?? this.STRINGS.en)[key] ?? this.STRINGS.en[key] ?? key;
  },

  STRINGS: {
    fr: {
      title: "Paramètres", general: "Général", look: "Apparence", effects: "Effets", layout: "Disposition",
      browsing: "Navigation", about: "À propos",
      language: "Langue", "language.d": "Par défaut, Orbit suit la langue de Windows",
      "lang.auto": "Automatique (système)", restart: "Redémarrer pour appliquer",
      font: "Police", "font.d": "Utilisée dans toute l'interface", "font.add": "Ajouter une police…",
      "font.system": "Police du système",
      spaceColors: "Couleurs de l'espace", custom: "Personnalisées",
      scheme: "Thème", "scheme.dark": "Sombre", "scheme.light": "Clair", "scheme.system": "Système",
      intensity: "Intensité des couleurs", radius: "Arrondi des coins",
      glass: "Verre liquide", "glass.d": "Reflets et transparence sur les onglets et les barres",
      nebula: "Nébuleuse animée", "nebula.d": "Nuage de couleur qui dérive lentement en arrière-plan",
      grain: "Étoiles et grain", "grain.d": "Texture fine sur l'arrière-plan",
      animations: "Animations", "animations.d": "Transitions et effets de mouvement",
      compact: "Mode compact", "compact.d": "Barre latérale cachée, visible au bord de l'écran (Ctrl+Alt+C)",
      sidebarRight: "Barre latérale à droite", sidebarWidth: "Largeur de la barre latérale",
      gap: "Marge autour de la page",
      commandbar: "Barre de commande", "commandbar.d": "Ctrl+T ouvre une recherche flottante au lieu d'un onglet vide",
      glance: "Glance", "glance.d": "Alt+clic sur un lien pour l'ouvrir en aperçu",
      unload: "Décharger les onglets inactifs", "unload.d": "Libère la mémoire des onglets inutilisés",
      "unload.never": "Jamais",
      advanced: "Paramètres avancés", import: "Importer depuis un autre navigateur",
      "about.tagline": "Un navigateur calme, rapide et beau.",
      "about.by": "Conçu et créé par",
      "about.engine": "Basé sur Gecko, le moteur de Firefox (MPL 2.0)",
      "about.credits": "Icônes Lucide (ISC) · Polices Outfit, Inter, Manrope, Space Grotesk, DM Sans (SIL OFL)",
      "about.update": "Rechercher des mises à jour", "about.source": "Code source",
    },
    en: {
      title: "Settings", general: "General", look: "Appearance", effects: "Effects", layout: "Layout",
      browsing: "Browsing", about: "About",
      language: "Language", "language.d": "By default Orbit follows the Windows language",
      "lang.auto": "Automatic (system)", restart: "Restart to apply",
      font: "Font", "font.d": "Used across the whole interface", "font.add": "Add a font…",
      "font.system": "System font",
      spaceColors: "Space colors", custom: "Custom",
      scheme: "Theme", "scheme.dark": "Dark", "scheme.light": "Light", "scheme.system": "System",
      intensity: "Color intensity", radius: "Corner radius",
      glass: "Liquid glass", "glass.d": "Highlights and translucency on tabs and bars",
      nebula: "Animated nebula", "nebula.d": "A color cloud slowly drifting in the background",
      grain: "Stars and grain", "grain.d": "Fine texture on the background",
      animations: "Animations", "animations.d": "Transitions and motion effects",
      compact: "Compact mode", "compact.d": "Sidebar hidden, shown at the screen edge (Ctrl+Alt+C)",
      sidebarRight: "Sidebar on the right", sidebarWidth: "Sidebar width", gap: "Space around the page",
      commandbar: "Command bar", "commandbar.d": "Ctrl+T opens a floating search instead of an empty tab",
      glance: "Glance", "glance.d": "Alt+click a link to preview it",
      unload: "Unload idle tabs", "unload.d": "Frees the memory of tabs you don't use",
      "unload.never": "Never",
      advanced: "Advanced settings", import: "Import from another browser",
      "about.tagline": "A calm, fast and beautiful browser.",
      "about.by": "Designed and built by",
      "about.engine": "Built on Gecko, the Firefox engine (MPL 2.0)",
      "about.credits": "Lucide icons (ISC) · Outfit, Inter, Manrope, Space Grotesk, DM Sans fonts (SIL OFL)",
      "about.update": "Check for updates", "about.source": "Source code",
    },
  },

  // ---- sheet ------------------------------------------------------------------
  toggle() {
    if (document.getElementById("orbit-settings")) this.close();
    else this.open();
  },

  open(sectionId = this._last ?? "general") {
    this.close(true);
    const h = Orbit.h.bind(Orbit);
    const nav = h("div", { class: "orbit-settings-nav" });
    const body = h("div", { class: "orbit-settings-body" });
    const sheet = h("div", { id: "orbit-settings", onmousedown: e => e.target == sheet && this.close() },
      h("div", { class: "orbit-settings-card" },
        h("div", { class: "orbit-settings-side" },
          h("div", { class: "orbit-settings-brand" },
            h("img", { class: "orbit-settings-logo", src: `${Orbit.BASE}orbit-logo.svg`, alt: "" }),
            h("span", {}, "Orbit")),
          nav),
        h("div", { class: "orbit-settings-main" },
          h("div", { class: "orbit-settings-top" },
            h("div", { class: "orbit-settings-h" }),
            h("button", { class: "orbit-icon-button", title: "Esc", onclick: () => this.close() }, Orbit.icon("x"))),
          body)
      )
    );
    this.show = id => {
      this._last = id;
      for (const b of nav.children) b.toggleAttribute("active", b.dataset.id == id);
      sheet.querySelector(".orbit-settings-h").textContent = this.t(id);
      const section = this.SECTIONS.find(s => s.id == id);
      body.replaceChildren(...section.items.map(item => this.render(item)).filter(Boolean));
      body.scrollTop = 0;
      if (!window.gReduceMotion) {
        body.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
          { duration: 260, easing: "cubic-bezier(.2,.9,.25,1)" });
      }
    };
    for (const s of this.SECTIONS) {
      nav.append(h("button", { class: "orbit-settings-tab", "data-id": s.id, onclick: () => this.show(s.id) },
        Orbit.icon(s.icon), h("span", {}, this.t(s.id))));
    }
    document.body.append(sheet);
    this.show(sectionId);
    this._onKey = e => {
      if (e.key != "Escape") return;
      e.preventDefault();
      if (!this.closeMenus()) this.close();
    };
    window.addEventListener("keydown", this._onKey, true);
  },

  close(instant = false) {
    const sheet = document.getElementById("orbit-settings");
    window.removeEventListener("keydown", this._onKey, true);
    if (!sheet) return;
    if (instant) return sheet.remove();
    sheet.setAttribute("closing", "true");
    setTimeout(() => sheet.remove(), 180);
  },

  // ---- rows ---------------------------------------------------------------------
  row(control, labelKey, extra = null) {
    const h = Orbit.h.bind(Orbit);
    const desc = this.t(`${labelKey}.d`);
    return h("div", { class: "orbit-setting" },
      h("div", { class: "orbit-setting-text" },
        h("div", { class: "orbit-setting-label" }, this.t(labelKey)),
        desc != `${labelKey}.d` ? h("div", { class: "orbit-setting-desc" }, desc) : null,
        extra),
      control);
  },

  render(item) {
    const h = Orbit.h.bind(Orbit);
    const p = Services.prefs;
    switch (item.kind) {
      case "toggle": {
        const read = () => Orbit.pref(item.pref, item.def ?? true) != !!item.invert;
        return this.row(this.switch(read(), on => p.setBoolPref(item.pref, on != !!item.invert)), item.label);
      }
      case "range":
        return this.row(this.slider({
          min: item.min, max: item.max, unit: item.unit, value: Orbit.pref(item.pref, item.min),
          onInput: v => p.setIntPref(item.pref, v),
        }), item.label);
      case "choice":
        return this.row(this.segmented(item.options.map(([v, key]) => [v, this.t(key)]),
          Orbit.pref(item.pref, 0), v => p.setIntPref(item.pref, v)), item.label);
      case "link":
        return h("button", { class: "orbit-setting orbit-setting-link", onclick: () => { this.close(); item.action(); } },
          h("div", { class: "orbit-setting-label" }, this.t(item.label)), Orbit.icon(item.icon ?? "chevron-right"));
      case "spacecolors":
        return this.renderSpaceColors();
      case "language":
        return this.renderLanguage();
      case "font":
        return this.renderFont();
      case "about":
        return this.renderAbout();
    }
    return null;
  },

  // ---- widgets ------------------------------------------------------------------
  switch(on, onChange) {
    const h = Orbit.h.bind(Orbit);
    const sw = h("button", {
      class: "orbit-switch", role: "switch", "aria-checked": String(on), on,
      onclick: () => {
        on = !on;
        sw.toggleAttribute("on", on);
        sw.setAttribute("aria-checked", String(on));
        onChange(on);
      },
    }, h("span", { class: "orbit-switch-knob" }));
    return sw;
  },

  // Fully custom slider: track, fill, thumb, value bubble, keyboard support.
  slider({ min, max, value, unit = "", step = 1, onInput }) {
    const h = Orbit.h.bind(Orbit);
    const fill = h("div", { class: "orbit-slider-fill" });
    const thumb = h("div", { class: "orbit-slider-thumb" });
    const out = h("span", { class: "orbit-slider-value" });
    const track = h("div", { class: "orbit-slider-track" }, fill, thumb);
    const el = h("div", { class: "orbit-slider", tabindex: 0, role: "slider", "aria-valuemin": min, "aria-valuemax": max },
      track, out);
    const set = (v, emit) => {
      v = Math.min(max, Math.max(min, Math.round(v / step) * step));
      const pct = ((v - min) / (max - min)) * 100;
      fill.style.width = `${pct}%`;
      thumb.style.left = `${pct}%`;
      out.textContent = `${v}${unit}`;
      el.setAttribute("aria-valuenow", v);
      if (emit && v != value) onInput(v);
      value = v;
    };
    const fromEvent = e => {
      const r = track.getBoundingClientRect();
      set(min + ((e.clientX - r.left) / r.width) * (max - min), true);
    };
    el.addEventListener("pointerdown", e => {
      if (e.button != 0) return;
      el.setPointerCapture(e.pointerId);
      el.setAttribute("dragging", "true");
      fromEvent(e);
    });
    el.addEventListener("pointermove", e => el.hasPointerCapture(e.pointerId) && fromEvent(e));
    el.addEventListener("pointerup", e => {
      el.releasePointerCapture(e.pointerId);
      el.removeAttribute("dragging");
    });
    el.addEventListener("keydown", e => {
      const d = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[e.key];
      if (d) {
        e.preventDefault();
        set(value + d * (e.shiftKey ? 5 : 1), true);
      }
    });
    set(value, false);
    return el;
  },

  segmented(options, current, onChange) {
    const h = Orbit.h.bind(Orbit);
    const seg = h("div", { class: "orbit-segmented" });
    const pill = h("div", { class: "orbit-segmented-pill" });
    seg.append(pill);
    const sync = () => {
      const active = [...seg.querySelectorAll("button")].find(b => b.dataset.v == String(current));
      for (const b of seg.querySelectorAll("button")) b.toggleAttribute("active", b == active);
      if (active) {
        pill.style.width = `${active.offsetWidth}px`;
        pill.style.transform = `translateX(${active.offsetLeft - 3}px)`;
      }
    };
    for (const [v, label] of options) {
      seg.append(h("button", { "data-v": v, onclick: () => { current = v; sync(); onChange(v); } }, label));
    }
    requestAnimationFrame(sync);
    return seg;
  },

  // Custom dropdown; options: [{value, label, font?}], footer: optional button.
  dropdown(options, current, onChange, footer = null) {
    const h = Orbit.h.bind(Orbit);
    const label = h("span", {});
    const btn = h("button", { class: "orbit-dropdown-button" }, label, Orbit.icon("chevron-down"));
    const wrap = h("div", { class: "orbit-dropdown" }, btn);
    const sync = () => {
      const o = options.find(o => o.value == current) ?? options[0];
      label.textContent = o.label;
      label.style.fontFamily = o.font ? `"${o.font}"` : "";
    };
    btn.addEventListener("click", () => {
      if (this.closeMenus()) return;
      const menu = h("div", { class: "orbit-dropdown-menu" },
        ...options.map(o => h("button", {
          class: "orbit-dropdown-item", active: o.value == current,
          style: o.font ? `font-family: "${o.font}" !important` : null,
          onclick: () => { current = o.value; sync(); this.closeMenus(); onChange(o.value); },
        }, h("span", {}, o.label), o.value == current ? Orbit.icon("check") : null)),
        footer ? h("div", { class: "orbit-dropdown-sep" }) : null,
        footer);
      wrap.append(menu);
    });
    sync();
    return wrap;
  },

  closeMenus() {
    const open = document.querySelectorAll("#orbit-settings .orbit-dropdown-menu");
    for (const m of open) m.remove();
    return open.length > 0;
  },

  // ---- special rows ----------------------------------------------------------------
  renderLanguage() {
    const h = Orbit.h.bind(Orbit);
    const available = Services.locale.availableLocales;
    const names = new Intl.DisplayNames([Services.locale.appLocaleAsBCP47], { type: "language" });
    const options = [{ value: "", label: this.t("lang.auto") }].concat(
      available.map(l => ({ value: l, label: names.of(l).replace(/^./, c => c.toUpperCase()) })));
    const current = Services.prefs.getCharPref("intl.locale.requested", "");
    const restart = h("button", {
      class: "orbit-button primary orbit-restart", hidden: true,
      onclick: () => Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart),
    }, Orbit.icon("refresh-cw"), this.t("restart"));
    const dd = this.dropdown(options, current, v => {
      Services.prefs.setCharPref("intl.locale.requested", v);
      restart.hidden = false;
    });
    return this.row(dd, "language", restart);
  },

  renderFont() {
    const custom = OrbitLayout.customFonts();
    const options = this.FONTS.map(f => ({
      value: f, label: f == "Segoe UI Variable Text" ? this.t("font.system") : f, font: f,
    })).concat(custom.map(f => ({ value: f.name, label: f.name, font: f.name })));
    const add = Orbit.h("button", { class: "orbit-dropdown-item orbit-dropdown-add", onclick: () => this.addFont() },
      Orbit.icon("square-plus"), Orbit.h("span", {}, this.t("font.add")));
    return this.row(this.dropdown(options, Orbit.pref("orbit.theme.font", "Outfit"),
      v => Services.prefs.setStringPref("orbit.theme.font", v), add), "font");
  },

  // Copies a .ttf/.otf/.woff2 into the profile and registers it.
  addFont() {
    this.closeMenus();
    const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    fp.init(window.browsingContext, this.t("font.add"), Ci.nsIFilePicker.modeOpen);
    fp.appendFilter("Fonts", "*.ttf; *.otf; *.woff; *.woff2");
    fp.open(rv => {
      if (rv != Ci.nsIFilePicker.returnOK || !fp.file) return;
      const dir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      dir.append("orbit-fonts");
      if (!dir.exists()) dir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
      fp.file.copyTo(dir, null);
      const name = fp.file.leafName.replace(/\.(ttf|otf|woff2?)$/i, "").replace(/[-_]+/g, " ").trim();
      const list = OrbitLayout.customFonts().filter(f => f.name != name);
      list.push({ name, file: fp.file.leafName });
      Services.prefs.setStringPref("orbit.fonts.custom", JSON.stringify(list));
      Services.prefs.setStringPref("orbit.theme.font", name);
      this.show("general");
    });
  },

  renderSpaceColors() {
    const h = Orbit.h.bind(Orbit);
    const space = OrbitSpaces.active;
    const current = OrbitSpaces.theme(space);
    const apply = patch => {
      Object.assign(space, patch);
      OrbitSpaces.save();
      OrbitSpaces.update({ animate: false });
      this.show("look");
    };
    const grid = h("div", { class: "orbit-theme-grid" },
      ...OrbitSpaces.THEMES.map(th => h("button", {
        class: "orbit-pick-theme", active: space.theme == th.id, title: th.id,
        style: `--c1:${th.c1};--c2:${th.c2}`, onclick: () => apply({ theme: th.id }),
      })));
    const picker = key => {
      const input = h("input", {
        type: "color", value: current[key],
        onchange: e => apply({ theme: "custom", c1: current.c1, c2: current.c2, [key]: e.target.value }),
      });
      return h("label", { class: "orbit-swatch", style: `--c:${current[key]}` }, input);
    };
    return h("div", { class: "orbit-setting orbit-setting-col" },
      h("div", { class: "orbit-setting-label" }, `${this.t("spaceColors")} · ${space.name}`),
      grid,
      h("div", { class: "orbit-custom-colors", active: space.theme == "custom" },
        h("span", {}, this.t("custom")), picker("c1"), picker("c2")));
  },

  renderAbout() {
    const h = Orbit.h.bind(Orbit);
    const repo = "https://github.com/realshavkat/orbit";
    const open = url => { this.close(); gBrowser.selectedTab = gBrowser.addTrustedTab(url); };
    return h("div", { class: "orbit-about" },
      h("img", { class: "orbit-about-logo", src: "chrome://branding/content/about-logo@2x.png", alt: "" }),
      h("div", { class: "orbit-about-name" }, "Orbit"),
      h("div", { class: "orbit-about-version" }, `Version ${Services.appinfo.version}`),
      h("div", { class: "orbit-about-tagline" }, this.t("about.tagline")),
      h("div", { class: "orbit-about-author" }, this.t("about.by"), " ", h("strong", {}, "shavkat"), " ",
        Orbit.icon("heart", "orbit-icon orbit-about-heart")),
      h("div", { class: "orbit-about-actions" },
        h("button", { class: "orbit-button primary", onclick: () => { this.close(); openAboutDialog(); } },
          Orbit.icon("refresh-cw"), this.t("about.update")),
        h("button", { class: "orbit-button", onclick: () => open(repo) }, Orbit.icon("code-xml"), this.t("about.source"))),
      h("div", { class: "orbit-about-fine" }, this.t("about.engine")),
      h("div", { class: "orbit-about-fine" }, this.t("about.credits")));
  },
};
