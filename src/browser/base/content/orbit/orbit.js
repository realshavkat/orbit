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
      if (typeof v == "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    el.append(...children.filter(c => c != null));
    return el;
  },

  // Services.search moved to a module in recent Gecko.
  get search() {
    return ChromeUtils.importESModule("moz-src:///toolkit/components/search/SearchService.sys.mjs").SearchService;
  },

  icon(name, cls = "orbit-icon") {
    return this.h("img", { class: cls, src: `${this.BASE}icons/${name}.svg`, alt: "" });
  },

  init() {
    for (const f of ["orbit-layout.js", "orbit-notify.js", "orbit-ai.js", "orbit-media.js", "orbit-memory.js", "orbit-spaces.js", "orbit-tabs.js", "orbit-glance.js", "orbit-settings.js", "orbit-menu.js", "orbit-welcome.js", "orbit-edit.js", "orbit-vpn.js", "orbit-extras.js", "orbit-folders.js", "orbit-kept.js", "orbit-updates.js", "orbit-mods.js", "orbit-import.js", "orbit-downloads.js", "orbit-background.js", "orbit-security.js"]) {
      Services.scriptloader.loadSubScript(this.BASE + f, window);
    }
    document.documentElement.setAttribute("orbit-lang", this.lang());
    OrbitLayout.init();
    const ready = () => {
      OrbitLayout.onReady();
      OrbitSpaces.init();
      OrbitTabs.init();
      OrbitGlance.init();
      OrbitMenu.init();
      OrbitEdit.init();
      OrbitVPN.init();
      OrbitExtras.init();
      OrbitFolders.init();
      OrbitKept.init();
      OrbitUpdates.init();
      OrbitMods.init();
      OrbitDownloads.init();
      OrbitBackground.init();
      OrbitAI.init();
      OrbitPiP.init();
      OrbitMedia.init();
      OrbitMemory.init();
      OrbitNotify.init();
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

// Advanced Picture-in-Picture: inject Orbit's script into every PiP window.
// The observer is app-wide, so only the first browser window registers it.
var OrbitPiP = {
  PLAYER: "chrome://global/content/pictureinpicture/player.xhtml",
  init() {
    if (Services.wm.getEnumerator("navigator:browser").getNext() != window) return;
    const onOpen = win => {
      win.addEventListener("load", () => {
        if (win.location.href != this.PLAYER) return;
        try {
          Services.scriptloader.loadSubScript(Orbit.BASE + "orbit-pip.js", win);
        } catch (e) {
          console.error("Orbit: PiP enhancements failed", e);
        }
      }, { once: true });
    };
    const obs = (subject, topic) => topic == "domwindowopened" && onOpen(subject);
    Services.ww.registerNotification(obs);
    window.addEventListener("unload", () => Services.ww.unregisterNotification(obs), { once: true });
  },
};

var ORBIT_STRINGS = {
  fr: {
    "space.default": "Personnel",
    "space.new": "Nouvel espace",
    "space.rename": "Renommer",
    "space.edit": "Modifier l'espace",
    "space.collapse": "Cliquer pour replier les favoris",
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
    "space.collapse": "Click to fold the essentials",
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
