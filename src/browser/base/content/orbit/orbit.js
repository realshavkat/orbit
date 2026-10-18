/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Orbit window bootstrap. Loaded into every browser.xhtml window (via the
// browser.xhtml patch, or tools/dev.mjs in dev). Feature scripts share the
// window scope and hang off the `Orbit` object.

var Orbit = {
  BASE: "chrome://orbit/content/",
  XHTML: "http://www.w3.org/1999/xhtml",

  // Tiny i18n: French or English, picked from the app locale.
  // UI language of Orbit's own strings: follows the app locale (fr or en).
  lang() {
    return Services.locale.appLocaleAsBCP47.startsWith("fr") ? "fr" : "en";
  },

  t(key) {
    return ORBIT_STRINGS[this.lang()][key] ?? ORBIT_STRINGS.en[key] ?? key;
  },

  pref(name, fallback) {
    const p = Services.prefs;
    switch (p.getPrefType(name)) {
      case p.PREF_BOOL: return p.getBoolPref(name);
      case p.PREF_INT: return p.getIntPref(name);
      case p.PREF_STRING: return p.getStringPref(name);
    }
    return fallback;
  },

  // Build DOM quickly: h("div", {class: "x", onclick}, child, "text").
  h(tag, attrs = {}, ...children) {
    const el = tag.includes(":")
      ? document.createXULElement(tag.split(":")[1])
      : document.createElementNS(this.XHTML, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    el.append(...children.filter(c => c != null));
    return el;
  },

  icon(name, cls = "orbit-icon") {
    return this.h("img", { class: cls, src: `${this.BASE}icons/${name}.svg`, alt: "" });
  },

  init() {
    for (const f of ["orbit-layout.js", "orbit-spaces.js", "orbit-tabs.js", "orbit-glance.js", "orbit-settings.js", "orbit-menu.js", "orbit-welcome.js"]) {
      Services.scriptloader.loadSubScript(this.BASE + f, window);
    }
    OrbitLayout.init();
    const ready = () => {
      OrbitLayout.onReady();
      OrbitSpaces.init();
      OrbitTabs.init();
      OrbitGlance.init();
      OrbitMenu.init();
      OrbitWelcome.maybeShow();
      document.documentElement.setAttribute("orbit-ready", "true");
    };
    if (gBrowserInit.delayedStartupFinished) ready();
    else {
      const obs = subject => {
        if (subject != window) return;
        Services.obs.removeObserver(obs, "browser-delayed-startup-finished");
        ready();
      };
      Services.obs.addObserver(obs, "browser-delayed-startup-finished");
    }
  },
};

var ORBIT_STRINGS = {
  fr: {
    "space.default": "Personnel",
    "space.new": "Nouvel espace",
    "space.rename": "Renommer",
    "space.edit": "Modifier l'espace",
    "space.delete": "Supprimer l'espace",
    "space.delete.confirm": "Supprimer cet espace et fermer ses onglets ?",
    "space.name": "Nom de l'espace",
    "space.icon": "Icône",
    "space.theme": "Couleurs",
    "space.create": "Créer",
    "space.save": "Enregistrer",
    "space.cancel": "Annuler",
    "tab.new": "Nouvel onglet",
    "compact.toggle": "Mode compact",
    "glance.expand": "Ouvrir en onglet",
    "glance.close": "Fermer",
    "glance.copy": "Copier le lien",
    "settings": "Paramètres",
    "commandbar.placeholder": "Rechercher ou saisir une adresse",
  },
  en: {
    "space.default": "Personal",
    "space.new": "New space",
    "space.rename": "Rename",
    "space.edit": "Edit space",
    "space.delete": "Delete space",
    "space.delete.confirm": "Delete this space and close its tabs?",
    "space.name": "Space name",
    "space.icon": "Icon",
    "space.theme": "Colors",
    "space.create": "Create",
    "space.save": "Save",
    "space.cancel": "Cancel",
    "tab.new": "New tab",
    "compact.toggle": "Compact mode",
    "glance.expand": "Open as tab",
    "glance.close": "Close",
    "glance.copy": "Copy link",
    "settings": "Settings",
    "commandbar.placeholder": "Search or enter address",
  },
};

if (document.readyState == "loading") {
  window.addEventListener("DOMContentLoaded", () => Orbit.init(), { once: true });
} else {
  Orbit.init();
}
