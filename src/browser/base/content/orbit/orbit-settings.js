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
        { kind: "updates" },
        { kind: "font" },
        { kind: "choice", pref: "browser.theme.toolbar-theme", label: "scheme",
          options: [[0, "scheme.dark"], [1, "scheme.light"], [2, "scheme.system"]] },
      ],
    },
    {
      id: "look", icon: "palette",
      items: [
        { kind: "spacecolors" },
        { kind: "background" },
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
        { kind: "mods" },
        { kind: "link", label: "themes", icon: "palette", action: () => BrowserAddonUI.openAddonsMgr("addons://list/theme") },
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
                { kind: "toggle", pref: "orbit.media.sidebar-player", label: "mediaPlayer" },
        { kind: "toggle", pref: "orbit.downloads.turbo", label: "turbo" },
        { kind: "choice", pref: "orbit.downloads.connections", label: "turboConn", options: [[4, "4"], [8, "8"], [16, "16"]] },
        { kind: "link", label: "advanced", icon: "external-link", action: () => openPreferences() },
        { kind: "link", label: "import", icon: "upload", action: () => OrbitImport.open() },
      ],
    },
    {
      id: "memory", icon: "gauge",
      items: [
        { kind: "presets" },
        { kind: "choice", pref: "orbit.tabs.unload-after-minutes", label: "unload",
          options: [[0, "unload.never"], [5, "5 min"], [20, "20 min"], [60, "1 h"], [-1, "unload.adaptive"]] },
        { kind: "choice", pref: "orbit.memory.budget-mb", label: "budget",
          options: [[0, "budget.off"], [1024, "1 Go"], [2048, "2 Go"], [4096, "4 Go"]] },
        { kind: "eco" },
        { kind: "link", label: "memoryPage", action: () => OrbitMemory.open() },
      ],
    },
    {
      id: "ai", icon: "bot",
      items: [
        { kind: "choice-str", pref: "browser.ml.chat.provider", label: "aiProvider",
          options: OrbitAI.ENGINES.map(e => [e.home, e.name]) },
        { kind: "link", label: "aiPanel", action: () => OrbitAI.toggleAssistant() },
        { kind: "info", label: "aiSearch" },
      ],
    },
    {
      id: "privacy", icon: "shield",
      items: [
        { kind: "fortress" },
        { kind: "vault" },
        { kind: "addon", id: "orbit-blocker@orbit.app", label: "blocker" },
        { kind: "strict", label: "strict" },
        { kind: "toggle", pref: "privacy.query_stripping.enabled", label: "stripping" },
        { kind: "toggle", pref: "dom.security.https_only_mode", label: "https", def: false },
        { kind: "toggle", pref: "privacy.fingerprintingProtection", label: "fingerprint", def: false },
        { kind: "choice", pref: "network.trr.mode", label: "doh", options: [[0, "doh.off"], [2, "doh.on"], [3, "doh.max"]] },
        { kind: "vpn" },
        { kind: "toggle", pref: "xpinstall.signatures.required", label: "unsigned", invert: true, def: true },
        { kind: "link", label: "installExt", icon: "puzzle", action: () => OrbitChromeExt.installFromDisk() },
        { kind: "link", label: "privacyAdvanced", icon: "external-link", action: () => openPreferences("privacy") },
      ],
    },
    {
      id: "notify", icon: "bell",
      items: ["pin", "default", "update", "sleep", "tips"].map(k =>
        ({ kind: "toggle", pref: `orbit.notify.${k}`, label: `notify.${k}`, def: k != "tips" })),
    },
    { id: "shortcuts", icon: "command", items: [{ kind: "shortcuts" }] },
    { id: "about", icon: "info", items: [{ kind: "about" }] },
  ],

  t(key) {
    return Orbit.dict(this.STRINGS)[key] ?? key;
  },

  STRINGS: {
    fr: {
      title: "Paramètres", general: "Général", look: "Apparence", effects: "Effets", layout: "Disposition",
      browsing: "Navigation", about: "À propos",
      unsigned: "Extensions Chrome et non signées", "unsigned.d": "Permet d'installer les extensions du Chrome Web Store. Elles ne sont pas vérifiées par Mozilla",
      installExt: "Installer une extension depuis un fichier (.crx, .xpi, .zip)",
      themes: "Thèmes Firefox", "themes.d": "Installe un thème depuis addons.mozilla.org : Orbit prend ses couleurs",
      turbo: "Orbit Turbo", "turbo.d": "Les gros téléchargements utilisent plusieurs connexions : fini les sites bridés par connexion",
      turboConn: "Connexions par téléchargement",
      updates: "Mises à jour", "updates.d": "Automatiques : installées au redémarrage. Me demander : une fenêtre présente les nouveautés au lancement",
      memory: "Mémoire", ai: "Intelligence artificielle", notify: "Notifications", privacy: "Vie privée", shortcuts: "Raccourcis",
      blocker: "Orbit Blocker", "blocker.d": "Bloque pubs, pisteurs, logiciels espions, bannières de cookies et l'accès des sites à ton réseau local",
      strict: "Protection renforcée contre le pistage", "strict.d": "Bloque aussi les cookies tiers et le contenu de pistage dans toutes les fenêtres",
      stripping: "Nettoyer les liens", "stripping.d": "Retire les paramètres de pistage des adresses (utm, fbclid…)",
      https: "HTTPS partout", "https.d": "Toujours une connexion chiffrée, avertissement sinon",
      fingerprint: "Anti-empreinte numérique", "fingerprint.d": "Brouille les informations qui permettent de te reconnaître",
      doh: "DNS sécurisé", "doh.d": "Chiffre les requêtes DNS (Cloudflare)", "doh.off": "Désactivé", "doh.on": "Activé", "doh.max": "Strict",
      privacyAdvanced: "Tous les réglages de vie privée",
      "unload.adaptive": "Adaptatif", "unload.d": "Un onglet en veille ne consomme presque rien et se recharge au clic",
      budget: "Plafond mémoire", "budget.d": "Au-delà, les onglets les plus anciens passent en veille", "budget.off": "Aucun",
      eco: "Mode éco", "eco.d": "2 processus au lieu de 4 (au prochain démarrage), fond figé, cache d'images réduit",
      memoryPage: "Voir la mémoire par onglet (orbit://memoire)",
      adblock: "Bloqueur de publicités", "adblock.d": "uBlock Origin Lite : bloque pubs et traqueurs, sans coût mémoire",
      mediaPlayer: "Lecteur dans la barre latérale", "mediaPlayer.d": "Contrôle la musique ou la vidéo d'un autre onglet",
      aiProvider: "Assistant du panneau", "aiProvider.d": "Ouvert à côté de la page avec Ctrl+Maj+U",
      aiPanel: "Ouvrir le panneau assistant",
      aiSearch: "Recherche avec l'IA", "aiSearch.d": "Tape @claude, @gpt, @perplexity ou @mistral suivi de ta question dans la barre d'adresse",
      "notify.pin": "Épingler à la barre des tâches", "notify.pin.d": "Proposé une seule fois au début",
      "notify.default": "Navigateur par défaut", "notify.default.d": "Demander si Orbit n'est pas le navigateur par défaut",
      "notify.update": "Mise à jour installée", "notify.update.d": "Prévenir après une mise à jour automatique",
      "notify.sleep": "Onglets mis en veille", "notify.sleep.d": "Quand Orbit libère de la mémoire",
      "notify.tips": "Astuces", "notify.tips.d": "De temps en temps, un raccourci utile",
      language: "Langue", "language.d": "Par défaut, Orbit suit la langue de Windows",
      "lang.auto": "Automatique (système)", restart: "Redémarrer pour appliquer",
      font: "Police", "font.d": "Utilisée dans toute l'interface", "font.add": "Ajouter une police…",
      "font.system": "Police du système",
      spaceColors: "Couleurs de l'espace", custom: "Personnalisées",
      scheme: "Thème", "scheme.dark": "Sombre", "scheme.light": "Clair", "scheme.system": "Système",
      intensity: "Intensité du fond", radius: "Arrondi des coins",
      glass: "Verre liquide", "glass.d": "Reflets et transparence sur les onglets et les barres",
      nebula: "Mouvement du fond", "nebula.d": "Les rubans de couleur dérivent lentement (en pause quand la fenêtre est inactive)",
      grain: "Grain", "grain.d": "Texture fine sur l'arrière-plan",
      animations: "Animations", "animations.d": "Transitions et effets de mouvement",
      compact: "Mode compact", "compact.d": "Barre latérale cachée, visible au bord de l'écran (Ctrl+Alt+C)",
      sidebarRight: "Barre latérale à droite", sidebarWidth: "Largeur de la barre latérale",
      gap: "Marge autour de la page",
      commandbar: "Barre de commande", "commandbar.d": "Ctrl+T ouvre une recherche flottante au lieu d'un onglet vide",
      glance: "Glance", "glance.d": "Alt+clic sur un lien pour l'ouvrir en aperçu",
      unload: "Mise en veille des onglets",
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
      unsigned: "Chrome and unsigned extensions", "unsigned.d": "Lets you install extensions from the Chrome Web Store. Mozilla does not check them",
      installExt: "Install an extension from a file (.crx, .xpi, .zip)",
      themes: "Firefox themes", "themes.d": "Install a theme from addons.mozilla.org: Orbit takes its colors",
      turbo: "Orbit Turbo", "turbo.d": "Big downloads use several connections: no more sites throttling each connection",
      turboConn: "Connections per download",
      updates: "Updates", "updates.d": "Automatic: installed on restart. Ask me: a window shows what's new at launch",
      memory: "Memory", ai: "Artificial intelligence", notify: "Notifications", privacy: "Privacy", shortcuts: "Shortcuts",
      blocker: "Orbit Blocker", "blocker.d": "Blocks ads, trackers, spyware, cookie banners and sites probing your local network",
      strict: "Strict tracking protection", "strict.d": "Also blocks third-party cookies and tracking content everywhere",
      stripping: "Clean links", "stripping.d": "Removes tracking parameters from addresses (utm, fbclid…)",
      https: "HTTPS everywhere", "https.d": "Always an encrypted connection, warns otherwise",
      fingerprint: "Anti-fingerprinting", "fingerprint.d": "Blurs the details that can identify you",
      doh: "Secure DNS", "doh.d": "Encrypts DNS lookups (Cloudflare)", "doh.off": "Off", "doh.on": "On", "doh.max": "Strict",
      privacyAdvanced: "All privacy settings",
      "unload.adaptive": "Adaptive", "unload.d": "A sleeping tab uses almost nothing and reloads on click",
      budget: "Memory limit", "budget.d": "Above it, the oldest tabs go to sleep", "budget.off": "None",
      eco: "Eco mode", "eco.d": "2 processes instead of 4 (next start), still background, smaller image cache",
      memoryPage: "Memory per tab (orbit://memory)",
      adblock: "Ad blocker", "adblock.d": "uBlock Origin Lite: blocks ads and trackers at no memory cost",
      mediaPlayer: "Sidebar media player", "mediaPlayer.d": "Control music or video playing in another tab",
      aiProvider: "Panel assistant", "aiProvider.d": "Opens beside the page with Ctrl+Shift+U",
      aiPanel: "Open the assistant panel",
      aiSearch: "Ask AI from the address bar", "aiSearch.d": "Type @claude, @gpt, @perplexity or @mistral followed by your question",
      "notify.pin": "Pin to taskbar", "notify.pin.d": "Offered once at the start",
      "notify.default": "Default browser", "notify.default.d": "Ask when Orbit is not the default browser",
      "notify.update": "Update installed", "notify.update.d": "Tell me after an automatic update",
      "notify.sleep": "Tabs put to sleep", "notify.sleep.d": "When Orbit frees memory",
      "notify.tips": "Tips", "notify.tips.d": "Now and then, a useful shortcut",
      language: "Language", "language.d": "By default Orbit follows the Windows language",
      "lang.auto": "Automatic (system)", restart: "Restart to apply",
      font: "Font", "font.d": "Used across the whole interface", "font.add": "Add a font…",
      "font.system": "System font",
      spaceColors: "Space colors", custom: "Custom",
      scheme: "Theme", "scheme.dark": "Dark", "scheme.light": "Light", "scheme.system": "System",
      intensity: "Background intensity", radius: "Corner radius",
      glass: "Liquid glass", "glass.d": "Highlights and translucency on tabs and bars",
      nebula: "Background motion", "nebula.d": "Color ribbons drift slowly (paused when the window is inactive)",
      grain: "Grain", "grain.d": "Fine texture on the background",
      animations: "Animations", "animations.d": "Transitions and motion effects",
      compact: "Compact mode", "compact.d": "Sidebar hidden, shown at the screen edge (Ctrl+Alt+C)",
      sidebarRight: "Sidebar on the right", sidebarWidth: "Sidebar width", gap: "Space around the page",
      commandbar: "Command bar", "commandbar.d": "Ctrl+T opens a floating search instead of an empty tab",
      glance: "Glance", "glance.d": "Alt+click a link to preview it",
      unload: "Put idle tabs to sleep",
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

  // Section titles: plain words + one key word in Syne (design).
  TITLES: {
    fr: { general: ["Réglages", "généraux"], look: ["Ton", "style"], effects: ["Les", "effets"], layout: ["Ta", "disposition"],
      ai: ["Ton", "IA"], browsing: ["Ta", "navigation"], privacy: ["Ta", "vie privée"], memory: ["Ta", "mémoire"],
      notify: ["Tes", "notifications"], shortcuts: ["Tes", "raccourcis"], about: ["À propos d'", "Orbit"] },
    en: { general: ["General", "settings"], look: ["Your", "style"], effects: ["The", "effects"], layout: ["Your", "layout"],
      ai: ["Your", "AI"], browsing: ["Your", "browsing"], privacy: ["Your", "privacy"], memory: ["Your", "memory"],
      notify: ["Your", "notifications"], shortcuts: ["Your", "shortcuts"], about: ["About", "Orbit"] },
  },

  open(sectionId = this._last ?? "general") {
    this.close(true);
    const h = Orbit.h.bind(Orbit);
    const fr = Orbit.lang() == "fr";
    const nav = h("div", { class: "orbit-settings-nav" });
    const body = h("div", { class: "orbit-settings-body" });
    const title = h("div", { class: "orbit-settings-h" });
    const search = h("input", {
      class: "orbit-settings-search-input", type: "search", placeholder: Orbit.tr("Search settings", "Rechercher un réglage"),
      oninput: () => this.filter(search.value),
    });
    const reset = h("button", { class: "orbit-settings-reset", onclick: () => this.resetSection(this._last) }, Orbit.tr("Reset", "Réinitialiser"));
    const sheet = h("div", { id: "orbit-settings", onmousedown: e => e.target == sheet && this.close() },
      h("div", { class: "orbit-settings-card" },
        h("div", { class: "orbit-settings-side" },
          h("div", { class: "orbit-settings-brand" },
            h("span", { class: "orbit-settings-logo-box" }, h("img", { class: "orbit-settings-logo", src: `${Orbit.BASE}orbit-logo.svg`, alt: "" })),
            h("span", {}, this.t("title"))),
          h("label", { class: "orbit-settings-search" }, Orbit.icon("search"), search),
          nav),
        h("div", { class: "orbit-settings-main" },
          h("div", { class: "orbit-settings-top" },
            title,
            h("span", { class: "orbit-settings-note" }, Orbit.tr("Applied instantly · ", "Tout est appliqué tout de suite · "), reset),
            h("button", { class: "orbit-icon-button", title: "Esc", onclick: () => this.close() }, Orbit.icon("x"))),
          body)
      )
    );
    const setTitle = id => {
      // Word order differs between languages: outside French and English the
      // whole section name is the key word.
      const [plain, key] = ["fr", "en"].includes(Orbit.lang()) ? Orbit.dict(this.TITLES)[id] ?? [this.t(id), ""] : ["", this.t(id)];
      title.replaceChildren(!plain || plain.endsWith("'") ? plain : `${plain} `, h("span", { class: "orbit-key" }, key));
    };
    this.show = id => {
      this._last = id;
      search.value = "";
      reset.hidden = !this.SECTIONS.find(s => s.id == id).items.some(i => i.pref);
      for (const b of nav.children) b.toggleAttribute("active", b.dataset.id == id);
      setTitle(id);
      const section = this.SECTIONS.find(s => s.id == id);
      body.replaceChildren(...section.items.map(item => this.render(item)).filter(Boolean));
      body.scrollTop = 0;
      if (!window.gReduceMotion) {
        body.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
          { duration: 260, easing: "cubic-bezier(.2,.9,.25,1)" });
      }
    };
    // Search: every section's rows whose text matches, grouped by section.
    this.filter = q => {
      const norm = x => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const needle = norm(q.trim());
      if (!needle) return this.show(this._last);
      for (const b of nav.children) b.removeAttribute("active");
      title.replaceChildren(Orbit.tr("Results for ", "Résultats pour "), h("span", { class: "orbit-key" }, q.trim()));
      reset.hidden = true;
      const out = [];
      for (const section of this.SECTIONS) {
        if (section.id == "about") continue;
        const rows = section.items.map(item => this.render(item)).filter(el => el && norm(el.textContent).includes(needle));
        if (rows.length) out.push(h("div", { class: "orbit-sheet-kicker orbit-settings-group" }, this.t(section.id).toUpperCase()), ...rows);
      }
      body.replaceChildren(...(out.length ? out : [h("div", { class: "orbit-setting-desc orbit-settings-empty" },
        Orbit.tr("No setting matches.", "Aucun réglage ne correspond."))]));
    };
    for (const s of this.SECTIONS) {
      if (s.id == "about") nav.append(h("div", { class: "orbit-settings-spacer" }));
      nav.append(h("button", { class: "orbit-settings-tab", "data-id": s.id, onclick: () => this.show(s.id) },
        Orbit.icon(s.icon), h("span", {}, this.t(s.id))));
    }
    document.body.append(sheet);
    this.show(sectionId);
    if (sectionId == "general") search.focus();
    this._onKey = e => {
      if (e.key != "Escape") return;
      e.preventDefault();
      if (search.value) return this.filter((search.value = ""));
      if (!this.closeMenus()) this.close();
    };
    window.addEventListener("keydown", this._onKey, true);
  },

  // Back to Orbit's defaults for every pref the section shows.
  resetSection(id) {
    for (const item of this.SECTIONS.find(s => s.id == id)?.items ?? []) {
      if (item.pref) Services.prefs.clearUserPref(item.pref);
    }
    this.show(id);
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
      case "choice-str":
        return this.row(this.segmented(item.options, Orbit.pref(item.pref, ""), v => p.setStringPref(item.pref, v)), item.label);
      case "info":
        return this.row(null, item.label);
      case "updates": {
        const fr = Orbit.lang() == "fr";
        const seg = this.segmented([["auto", Orbit.tr("Automatic", "Automatiques")], ["ask", Orbit.tr("Ask me", "Me demander")]], "auto",
          v => OrbitUpdates.setAuto(v == "auto"));
        OrbitUpdates.isAuto().then(auto => !auto && seg.querySelector('[data-v="ask"]')?.click());
        return this.row(seg, "updates");
      }
      case "fortress": {
        const fr = Orbit.lang() == "fr";
        const h = Orbit.h.bind(Orbit);
        return h("div", { class: "orbit-setting orbit-setting-col orbit-fortress", on: OrbitSecurity.on },
          h("div", { class: "orbit-vpn-head" },
            h("div", { class: "orbit-setting-text" },
              h("div", { class: "orbit-setting-label" }, Orbit.tr("Fortress mode", "Mode forteresse")),
              h("div", { class: "orbit-setting-desc" }, Orbit.tr("Maximum security: JavaScript without JIT compilers, no WebGL or WebRTC, HTTPS only, strict tracking protection and anti-fingerprinting. Some sites get slower or less compatible.", "Sécurité maximale : moteur JavaScript sans compilateur JIT, pas de WebGL ni WebRTC, HTTPS obligatoire, anti-pistage strict et anti-empreinte. Certains sites seront plus lents ou moins compatibles."))),
            this.switch(OrbitSecurity.on, v => { OrbitSecurity.set(v); this.show(this._last); })));
      }
      case "vault":
        return this.renderVault();
      case "mods":
        return this.renderMods();
      case "presets":
        return this.renderPresets();
      case "background":
        return this.renderBackground();
      case "strict":
        return this.row(this.switch(Orbit.pref("browser.contentblocking.category", "standard") == "strict",
          on => p.setStringPref("browser.contentblocking.category", on ? "strict" : "standard")), "strict");
      case "vpn":
        return this.renderVPN();
      case "shortcuts":
        return this.renderShortcuts();
      case "eco":
        return this.row(this.switch(Orbit.pref("orbit.memory.eco", false), on => OrbitMemory.setEco(on)), "eco");
      case "addon": {
        const row = this.row(this.switch(true, async on => {
          const addon = await AddonManager.getAddonByID(item.id);
          if (addon) await (on ? addon.enable() : addon.disable());
        }), item.label);
        // Hide the row when the add-on is missing; reflect its real state.
        AddonManager.getAddonByID(item.id).then(a => {
          if (!a) row.remove();
          else if (a.userDisabled) row.lastChild.click();
        });
        return row;
      }
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

  // Anti-stealer vault. Malware that copies a browser profile gets the saved
  // passwords unless a primary password encrypts them; Windows sign-in guards
  // showing and filling them; sessions can be wiped at every close.
  renderVault() {
    const h = Orbit.h.bind(Orbit);
    const p = Services.prefs;
    const fr = Orbit.lang() == "fr";
    const { LoginHelper } = ChromeUtils.importESModule("resource://gre/modules/LoginHelper.sys.mjs");
    const locked = LoginHelper.isPrimaryPasswordSet();
    const status = h("span", { class: "orbit-vault-status", ok: locked },
      locked ? (Orbit.tr("Passwords encrypted", "Mots de passe chiffrés")) : (Orbit.tr("Passwords not protected", "Mots de passe non protégés")));
    const row = (label, desc, on, set) => h("label", { class: "orbit-vpn-toggle orbit-vault-row" },
      h("span", {}, h("b", {}, label), h("small", {}, desc)), this.switch(on, set));
    return h("div", { class: "orbit-setting orbit-setting-col orbit-vault" },
      h("div", { class: "orbit-vpn-head" },
        h("div", { class: "orbit-setting-text" },
          h("div", { class: "orbit-setting-label" }, Orbit.tr("Anti-theft vault", "Coffre-fort anti-vol")),
          h("div", { class: "orbit-setting-desc" }, Orbit.tr("If malware copies your profile, it cannot read anything without your primary password.", "Si un logiciel malveillant copie ton profil, il ne peut rien lire sans ton mot de passe principal."))),
        status),
      h("button", { class: locked ? "orbit-button" : "orbit-button primary", onclick: () => {
        window.openDialog("chrome://mozapps/content/preferences/changemp.xhtml", "", "centerscreen,chrome,modal,titlebar");
        this.show(this._last);
      } }, Orbit.icon("shield"), locked ? (Orbit.tr("Change primary password", "Changer le mot de passe principal"))
        : (Orbit.tr("Create a primary password", "Créer un mot de passe principal"))),
      row(Orbit.tr("Windows Hello to view passwords", "Windows Hello pour voir les mots de passe"),
        Orbit.tr("Your PIN or face before showing or exporting a password", "Ton code PIN ou ton visage avant d'afficher ou d'exporter un mot de passe"),
        Orbit.pref("signon.management.page.os-auth.locked.enabled", true),
        on => p.setBoolPref("signon.management.page.os-auth.locked.enabled", on)),
      row(Orbit.tr("Clear cookies and sessions on close", "Effacer cookies et sessions à la fermeture"),
        Orbit.tr("Stolen cookies become useless. You will sign in to sites again.", "Un vol de cookies ne sert à rien. Tu devras te reconnecter à tes sites."),
        Orbit.pref("privacy.clearOnShutdown_v2.cookiesAndStorage", false) && Orbit.pref("privacy.sanitize.sanitizeOnShutdown", false),
        on => {
          p.setBoolPref("privacy.sanitize.sanitizeOnShutdown", on);
          p.setBoolPref("privacy.clearOnShutdown_v2.cookiesAndStorage", on);
        }));
  },

  renderBackground() {
    const h = Orbit.h.bind(Orbit);
    const p = Services.prefs;
    const fr = Orbit.lang() == "fr";
    const type = Orbit.pref("orbit.background.type", "liquid");
    const extra = h("div", { class: "orbit-bg-extra" });
    const fillExtra = t => {
      const kids = [];
      if (t == "image" || t == "video") {
        kids.push(h("button", { class: "orbit-button", onclick: async () => {
          if (await OrbitBackground.choose()) this.show(this._last);
        } }, Orbit.icon("upload"), Orbit.tr("Choose a file…", "Choisir un fichier…")));
      }
      if (t == "color") {
        kids.push(h("input", { type: "color", class: "orbit-bg-color", value: Orbit.pref("orbit.background.color", "#0b0b14"),
          oninput: e => p.setStringPref("orbit.background.color", e.target.value) }));
      }
      if (t != "liquid") {
        kids.push(h("span", { class: "orbit-setting-desc" }, Orbit.tr("Dim", "Assombrir")),
          this.slider({ min: 0, max: 85, unit: " %", value: Orbit.pref("orbit.background.dim", 35),
            onInput: v => p.setIntPref("orbit.background.dim", v) }));
      }
      extra.replaceChildren(...kids);
    };
    fillExtra(type);
    return h("div", { class: "orbit-setting orbit-setting-col" },
      h("div", { class: "orbit-vpn-head" },
        h("div", { class: "orbit-setting-text" },
          h("div", { class: "orbit-setting-label" }, Orbit.tr("Background", "Fond")),
          h("div", { class: "orbit-setting-desc" }, Orbit.tr("Orbit's liquid background, your picture, a looping video or a color", "Le fond liquide d'Orbit, ta photo, une vidéo en boucle ou une couleur"))),
        this.segmented([["liquid", Orbit.tr("Liquid", "Liquide")], ["image", "Image"], ["video", Orbit.tr("Video", "Vidéo")], ["color", Orbit.tr("Color", "Couleur")]],
          type, v => {
            fillExtra(v);
            if (v == "liquid" || v == "color" || Orbit.pref("orbit.background.file", "")) p.setStringPref("orbit.background.type", v);
          })),
      extra);
  },

  renderPresets() {
    const h = Orbit.h.bind(Orbit);
    const PLANETS = [
      ["mercure", Orbit.tr("Mercury", "Mercure"), Orbit.tr("Maximum speed", "Vitesse maximale"), "#c9a27e"],
      ["venus", Orbit.tr("Venus", "Vénus"), Orbit.tr("Balanced", "Équilibré"), "#e8c26a"],
      ["saturne", Orbit.tr("Saturn", "Saturne"), Orbit.tr("Light on memory", "Économe"), "#d8b98a"],
      ["neptune", Orbit.tr("Neptune", "Neptune"), Orbit.tr("Ultra light", "Ultra léger"), "#5b7cff"],
    ];
    const current = Orbit.pref("orbit.performance.preset", "venus");
    const note = h("div", { class: "orbit-setting-desc", hidden: true }, this.t("restart"));
    const cards = h("div", { class: "orbit-presets" }, ...PLANETS.map(([id, name, desc, color]) =>
      h("button", { class: "orbit-preset", active: id == current, style: `--planet:${color}`, onclick: e => {
        OrbitMemory.applyPreset(id);
        for (const c of cards.children) c.toggleAttribute("active", c == e.currentTarget);
        note.hidden = false;
      } }, h("span", { class: "orbit-planet" }), h("b", {}, name), h("small", {}, desc))));
    return h("div", { class: "orbit-setting orbit-setting-col" },
      h("div", { class: "orbit-setting-text" },
        h("div", { class: "orbit-setting-label" }, Orbit.tr("Performance", "Performances")),
        h("div", { class: "orbit-setting-desc" }, Orbit.tr("A preset per planet, from the fastest to the lightest. Every setting below stays adjustable.",
          "Un préréglage par planète, du plus rapide au plus léger. Chaque réglage ci-dessous reste modifiable."))),
      cards, note);
  },

  renderMods() {
    const h = Orbit.h.bind(Orbit);
    const fr = Orbit.lang() == "fr";
    const list = h("div", { class: "orbit-mods-list" });
    const fill = async () => {
      const names = await OrbitMods.list();
      const off = OrbitMods.disabled();
      list.replaceChildren(...(names.length ? names.map(n => h("div", { class: "orbit-mods-item" },
        h("span", {}, n), this.switch(!off.has(n), on => OrbitMods.toggle(n, on))))
        : [h("div", { class: "orbit-setting-desc" }, Orbit.tr("No mods yet.", "Aucun mod pour l'instant."))]));
    };
    fill();
    return h("div", { class: "orbit-setting orbit-setting-col" },
      h("div", { class: "orbit-setting-text" },
        h("div", { class: "orbit-setting-label" }, Orbit.tr("Mods", "Mods")),
        h("div", { class: "orbit-setting-desc" }, Orbit.tr(".css files that change Orbit's interface: colors, sizes, animations. userChrome.css works too.", "Des fichiers .css qui changent l'interface d'Orbit : couleurs, tailles, animations. userChrome.css fonctionne aussi."))),
      list,
      h("div", { class: "orbit-mods-actions" },
        h("button", { class: "orbit-button", onclick: () => OrbitMods.openFolder() }, Orbit.icon("external-link"), Orbit.tr("Open folder", "Ouvrir le dossier")),
        h("button", { class: "orbit-button", onclick: async () => { await OrbitMods.apply(); fill(); } }, Orbit.icon("refresh-cw"), Orbit.tr("Reload", "Recharger"))));
  },

  renderVPN() {
    const h = Orbit.h.bind(Orbit);
    const p = Services.prefs;
    const fr = Orbit.lang() == "fr";
    const input = h("input", {
      class: "orbit-input", placeholder: "socks5://127.0.0.1:9050", spellcheck: "false",
      value: Orbit.pref("orbit.vpn.server", ""),
      onchange: () => {
        const v = input.value.trim();
        const ok = !v || OrbitVPN.parse(v);
        input.toggleAttribute("invalid", !ok);
        if (ok) p.setStringPref("orbit.vpn.server", v);
      },
    });
    const custom = h("div", { class: "orbit-vpn-custom" }, input,
      h("div", { class: "orbit-setting-desc" }, Orbit.tr("Your own SOCKS5 or HTTPS server: a VPS, Tor (socks5://127.0.0.1:9050) or a VPN app's proxy.", "Ton propre serveur SOCKS5 ou HTTPS : un VPS, Tor (socks5://127.0.0.1:9050) ou le proxy d'une appli VPN.")));
    const sync = () => (custom.hidden = Orbit.pref("orbit.vpn.mode", "custom") != "custom");
    sync();
    return h("div", { class: "orbit-setting orbit-setting-col" },
      h("div", { class: "orbit-vpn-head" },
        h("div", { class: "orbit-setting-text" },
          h("div", { class: "orbit-setting-label" }, "Orbit VPN"),
          h("div", { class: "orbit-setting-desc" }, Orbit.tr("Hides your IP address. DNS goes through the tunnel and WebRTC cannot reveal your real IP.", "Masque ton adresse IP. Les DNS passent par le tunnel et WebRTC ne peut pas révéler ta vraie IP."))),
        this.switch(Orbit.pref("orbit.vpn.enabled", false), on => OrbitVPN.apply(on))),
      custom);
  },

  SHORTCUTS: [
    ["Ctrl T", "Nouvel onglet / barre de commande", "New tab / command bar"],
    ["Ctrl Maj Espace", "Rechercher un onglet", "Search tabs"],
    ["Ctrl Maj U", "Assistant IA", "AI assistant"],
    ["Alt clic", "Aperçu d'un lien (Glance)", "Preview a link (Glance)"],
    ["Ctrl Alt C", "Mode compact", "Compact mode"],
    ["Alt 1 – 9", "Aller à l'espace 1 à 9", "Go to space 1 to 9"],
    ["Ctrl Alt ← →", "Espace précédent / suivant", "Previous / next space"],
    ["Ctrl Maj D", "Dupliquer l'onglet", "Duplicate tab"],
    ["Ctrl Maj T", "Rouvrir l'onglet fermé", "Reopen closed tab"],
    ["Ctrl ,", "Paramètres", "Settings"],
    ["Ctrl Maj ]", "Picture-in-Picture", "Picture-in-Picture"],
  ],

  renderShortcuts() {
    const h = Orbit.h.bind(Orbit);
    const fr = Orbit.lang() == "fr";
    return h("div", { class: "orbit-shortcuts" }, ...this.SHORTCUTS.map(([keys, frLabel, enLabel]) =>
      h("div", { class: "orbit-setting" },
        h("div", { class: "orbit-setting-label" }, Orbit.tr(enLabel, frLabel)),
        h("span", { class: "orbit-keys" }, ...(fr ? keys : keys.replace("Maj", "Shift")).split(" ").map(k => h("kbd", {}, k))))));
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
      seg.append(h("button", { "data-v": String(v), onclick: () => { current = v; sync(); onChange(v); } }, label));
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
