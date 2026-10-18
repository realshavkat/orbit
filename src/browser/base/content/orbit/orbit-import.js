/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Import: finds the browsers installed on this computer and brings
// everything over in one click (bookmarks, history, passwords, form data,
// payment methods, extensions, open tabs), using Gecko's migrators.
var OrbitImport = {
  // Gecko resource types, in display order.
  TYPES: [["BOOKMARKS", "bookmarks"], ["HISTORY", "history"], ["PASSWORDS", "passwords"], ["FORMDATA", "forms"],
    ["PAYMENT_METHODS", "payments"], ["EXTENSIONS", "extensions"], ["SESSION", "tabs"], ["COOKIES", "cookies"]],

  t(k) {
    const fr = Orbit.lang() == "fr";
    return {
      kicker: fr ? "IMPORTER" : "IMPORT",
      title: fr ? "Retrouve" : "Bring",
      key: fr ? "tes affaires" : "your stuff",
      sub: fr ? "Orbit a trouvé ces navigateurs sur ton ordinateur." : "Orbit found these browsers on your computer.",
      none: fr ? "Aucun autre navigateur trouvé." : "No other browser found.",
      all: fr ? "Tout importer" : "Import everything",
      importing: fr ? "Import en cours…" : "Importing…",
      done: fr ? "Importé" : "Imported",
      failed: fr ? "Échec, réessaie" : "Failed, try again",
      more: fr ? "Plus d'options (fichier, choix précis)" : "More options (file, pick items)",
      note: fr ? "Les cookies de Chrome, Edge et Brave sont chiffrés par Windows et ne peuvent pas être copiés : reconnecte-toi une fois à tes sites."
        : "Chrome, Edge and Brave cookies are encrypted by Windows and cannot be copied: sign in to your sites once.",
      bookmarks: fr ? "Marque-pages" : "Bookmarks", history: fr ? "Historique" : "History",
      passwords: fr ? "Mots de passe" : "Passwords", forms: fr ? "Formulaires" : "Form data",
      payments: fr ? "Cartes" : "Cards", extensions: fr ? "Extensions" : "Extensions",
      tabs: fr ? "Onglets ouverts" : "Open tabs", cookies: fr ? "Cookies" : "Cookies",
    }[k];
  },

  get l10n() {
    return (this._l10n ??= new Localization(["browser/migrationWizard.ftl", "branding/brand.ftl"]));
  },

  get MigrationUtils() {
    return ChromeUtils.importESModule("resource:///modules/MigrationUtils.sys.mjs").MigrationUtils;
  },

  // [{ key, name, icon, profile, types }]
  async detect() {
    const MU = this.MigrationUtils;
    const out = [];
    for (const key of MU.availableMigratorKeys) {
      if (key == "internal-testing") continue;
      let migrator;
      try {
        migrator = await MU.getMigrator(key);
      } catch {}
      if (!migrator) continue;
      const profiles = (await migrator.getSourceProfiles()) ?? [null];
      const C = migrator.constructor;
      const name = C.displayNameL10nID.startsWith("migration-")
        ? await this.l10n.formatValue(C.displayNameL10nID) : C.displayNameL10nID;
      for (const profile of profiles) {
        const types = await migrator.getMigrateData(profile);
        if (!types) continue;
        out.push({ key, migrator, name: profile?.name && profiles.length > 1 ? `${name} · ${profile.name}` : name,
          icon: C.brandImage, profile, types });
      }
    }
    return out;
  },

  async open() {
    document.getElementById("orbit-import")?.remove();
    const h = Orbit.h.bind(Orbit);
    const list = h("div", { class: "orbit-import-list" }, h("div", { class: "orbit-setting-desc" }, "…"));
    const close = () => {
      sheet.setAttribute("closing", "true");
      setTimeout(() => sheet.remove(), 180);
    };
    const sheet = h("div", { id: "orbit-import", class: "orbit-sheet", onmousedown: e => e.target == sheet && close() },
      h("div", { class: "orbit-sheet-card orbit-import-card" },
        h("div", { class: "orbit-settings-top orbit-import-top" },
          h("div", {},
            h("div", { class: "orbit-sheet-kicker" }, this.t("kicker")),
            h("div", { class: "orbit-update-title" }, `${this.t("title")} `, h("span", { class: "orbit-key" }, this.t("key"))),
            h("div", { class: "orbit-setting-desc" }, this.t("sub"))),
          h("button", { class: "orbit-icon-button", "aria-label": "Fermer", onclick: close }, Orbit.icon("x"))),
        list,
        h("div", { class: "orbit-vpn-note" }, Orbit.icon("info"), h("span", {}, this.t("note"))),
        h("button", { class: "orbit-toast-link orbit-import-more", onclick: () => {
          close();
          this.MigrationUtils.showMigrationWizard(window, {});
        } }, this.t("more"))));
    document.body.append(sheet);
    const found = await this.detect();
    const RT = this.MigrationUtils.resourceTypes;
    list.replaceChildren(...(found.length ? found.map(src => {
      const btn = h("button", { class: "orbit-toast-b1" }, this.t("all"));
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = this.t("importing");
        try {
          await src.migrator.migrate(src.types, null, src.profile);
          btn.textContent = this.t("done");
          btn.classList.add("orbit-import-done");
        } catch (e) {
          console.error("Orbit import", e);
          btn.disabled = false;
          btn.textContent = this.t("failed");
        }
      });
      return h("div", { class: "orbit-import-item" },
        h("img", { src: src.icon, alt: "" }),
        h("div", { class: "orbit-import-text" },
          h("b", {}, src.name),
          h("div", { class: "orbit-import-chips" }, ...this.TYPES.filter(([type]) => src.types & RT[type])
            .map(([, label]) => h("span", {}, this.t(label))))),
        btn);
    }) : [h("div", { class: "orbit-setting-desc" }, this.t("none"))]));
  },
};
