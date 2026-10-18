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
      tabs: fr ? "Onglets ouverts" : "Open tabs", cookies: fr ? "Cookies et sessions" : "Cookies and sessions",
      containers: fr ? "Conteneurs" : "Containers",
    }[k];
  },

  // ---- Zen (and other Gecko browsers): the whole profile ---------------------------
  // Zen keeps a Gecko profile, so Orbit can take it as is: a new Orbit profile
  // gets Zen's data files, then Orbit restarts into it. Zen's UI settings
  // (prefs.js, chrome/, layout) stay behind so Orbit keeps its own look.
  GECKO_SOURCES: [["Zen Browser", ["zen"]], ["Floorp", ["Floorp"]], ["LibreWolf", ["librewolf"]], ["Waterfox", ["Waterfox"]]],
  PROFILE_FILES: ["places.sqlite", "favicons.sqlite", "cookies.sqlite", "key4.db", "cert9.db", "logins.json",
    "logins-backup.json", "formhistory.sqlite", "autofill-profiles.json", "permissions.sqlite", "content-prefs.sqlite",
    "containers.json", "handlers.json", "search.json.mozlz4", "extensions.json", "extension-preferences.json",
    "extension-settings.json", "sessionstore.jsonlz4", "persdict.dat"],
  PROFILE_DIRS: ["extensions", "browser-extension-data", "storage", "sessionstore-backups", "bookmarkbackups"],

  async geckoProfiles() {
    const out = [];
    const appData = Services.dirsvc.get("AppData", Ci.nsIFile).path;
    for (const [name, [dir]] of this.GECKO_SOURCES) {
      const root = PathUtils.join(appData, dir);
      const ini = PathUtils.join(root, "profiles.ini");
      if (!(await IOUtils.exists(ini))) continue;
      const text = await IOUtils.readUTF8(ini);
      for (const block of text.split(/^\[/m)) {
        if (!/^Profile\d+\]/.test(block)) continue;
        const get = k => new RegExp(`^${k}=(.*)$`, "m").exec(block)?.[1]?.trim();
        const path = get("Path");
        if (!path) continue;
        const full = get("IsRelative") == "1" ? PathUtils.join(root, ...path.split("/")) : path;
        if (!(await IOUtils.exists(PathUtils.join(full, "places.sqlite")))) continue;
        const { size } = await IOUtils.stat(PathUtils.join(full, "places.sqlite"));
        out.push({ gecko: true, name: `${name} · ${get("Name") ?? path}`, path: full, size, icon: this.exeIcon(name) });
      }
    }
    // The most used profile first.
    return out.sort((a, b) => b.size - a.size);
  },

  // The browser's own icon, read from its .exe (Windows), or a generic one.
  exeIcon(name) {
    const exe = { "Zen Browser": "zen.exe", Floorp: "floorp.exe", LibreWolf: "librewolf.exe", Waterfox: "waterfox.exe" }[name];
    for (const base of ["ProgF", "LocalAppData"]) {
      try {
        const dir = Services.dirsvc.get(base, Ci.nsIFile);
        for (const sub of [name, `${name}\${name}`, `Programs\${name}`]) {
          const f = new FileUtils.File(PathUtils.join(dir.path, ...sub.split("\\"), exe));
          if (f.exists()) return `moz-icon://${Services.io.newFileURI(f).spec}?size=32`;
        }
      } catch {}
    }
    return "chrome://global/skin/icons/defaultFavicon.svg";
  },

  // A running browser keeps parent.lock open; reading it then fails.
  async isRunning(profilePath) {
    const lock = PathUtils.join(profilePath, "parent.lock");
    if (!(await IOUtils.exists(lock))) return false;
    try {
      await IOUtils.read(lock, { maxBytes: 1 });
      return false;
    } catch {
      return true;
    }
  },

  async importGeckoProfile(src) {
    const fr = Orbit.lang() == "fr";
    if (await this.isRunning(src.path)) {
      Services.prompt.alert(window, "Orbit", fr ? `Ferme d'abord ${src.name.split(" · ")[0]}, puis réessaie.`
        : `Close ${src.name.split(" · ")[0]} first, then try again.`);
      return false;
    }
    const ok = Services.prompt.confirm(window, "Orbit", fr
      ? "Orbit va créer un profil avec toutes tes données (marque-pages, historique, mots de passe, cookies et sessions, extensions, conteneurs, onglets) puis redémarrer dessus. Ton profil Orbit actuel reste disponible."
      : "Orbit will create a profile with all your data (bookmarks, history, passwords, cookies and sessions, extensions, containers, tabs) and restart into it. Your current Orbit profile stays available.");
    if (!ok) return false;
    const service = Cc["@mozilla.org/toolkit/profile-service;1"].getService(Ci.nsIToolkitProfileService);
    const profile = service.createProfile(null, `Orbit (${src.name.split(" · ")[0]})`);
    const dest = profile.rootDir.path;
    await IOUtils.makeDirectory(dest, { ignoreExisting: true });
    for (const f of this.PROFILE_FILES) {
      const from = PathUtils.join(src.path, f);
      if (await IOUtils.exists(from)) await IOUtils.copy(from, PathUtils.join(dest, f));
    }
    for (const d of this.PROFILE_DIRS) {
      const from = PathUtils.join(src.path, d);
      if (await IOUtils.exists(from)) await IOUtils.copy(from, PathUtils.join(dest, d), { recursive: true });
    }
    // Orbit's own first-run is already done for this person.
    await IOUtils.writeUTF8(PathUtils.join(dest, "user.js"),
      `user_pref("orbit.welcome.done", true);\nuser_pref("orbit.user.name", ${JSON.stringify(Orbit.pref("orbit.user.name", ""))});\n` +
      `user_pref("browser.startup.page", 3);\n`);
    service.defaultProfile = profile;
    service.flush();
    Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
    return true;
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
    const found = [...(await this.geckoProfiles()), ...(await this.detect())];
    const RT = this.MigrationUtils.resourceTypes;
    list.replaceChildren(...(found.length ? found.map(src => {
      const btn = h("button", { class: "orbit-toast-b1" }, this.t("all"));
      btn.addEventListener("click", async () => {
        if (src.gecko) {
          btn.disabled = true;
          btn.textContent = this.t("importing");
          if (!(await this.importGeckoProfile(src))) {
            btn.disabled = false;
            btn.textContent = this.t("all");
          }
          return;
        }
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
          h("div", { class: "orbit-import-chips" }, ...(src.gecko ? ["bookmarks", "history", "passwords", "cookies", "extensions", "tabs", "containers"]
            : this.TYPES.filter(([type]) => src.types & RT[type]).map(([, label]) => label)).map(label => h("span", {}, this.t(label))))),
        btn);
    }) : [h("div", { class: "orbit-setting-desc" }, this.t("none"))]));
  },
};
