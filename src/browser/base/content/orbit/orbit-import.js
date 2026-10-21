/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var OrbitImport = {
  TYPES: [["BOOKMARKS", "bookmarks"], ["HISTORY", "history"], ["PASSWORDS", "passwords"], ["FORMDATA", "forms"],
    ["PAYMENT_METHODS", "payments"], ["EXTENSIONS", "extensions"], ["SESSION", "tabs"], ["COOKIES", "cookies"]],

  t(k) {
    const fr = Orbit.lang() == "fr";
    return {
      kicker: Orbit.tr("IMPORT", "IMPORTER"),
      title: Orbit.tr("Bring", "Retrouve"),
      key: Orbit.tr("your stuff", "tes affaires"),
      sub: Orbit.tr("Orbit found these browsers on your computer.", "Orbit a trouvé ces navigateurs sur ton ordinateur."),
      none: Orbit.tr("No other browser found.", "Aucun autre navigateur trouvé."),
      all: Orbit.tr("Import everything", "Tout importer"),
      importing: Orbit.tr("Importing…", "Import en cours…"),
      done: Orbit.tr("Imported", "Importé"),
      failed: Orbit.tr("Failed, try again", "Échec, réessaie"),
      more: Orbit.tr("More options (file, pick items)", "Plus d'options (fichier, choix précis)"),
      note: Orbit.tr("Chrome, Edge and Brave cookies are encrypted by Windows and cannot be copied: sign in to your sites once.", "Les cookies de Chrome, Edge et Brave sont chiffrés par Windows et ne peuvent pas être copiés : reconnecte-toi une fois à tes sites."),
      bookmarks: Orbit.tr("Bookmarks", "Marque-pages"), history: Orbit.tr("History", "Historique"),
      passwords: Orbit.tr("Passwords", "Mots de passe"), forms: Orbit.tr("Form data", "Formulaires"),
      payments: Orbit.tr("Cards", "Cartes"), extensions: Orbit.tr("Extensions", "Extensions"),
      tabs: Orbit.tr("Open tabs", "Onglets ouverts"), cookies: Orbit.tr("Cookies and sessions", "Cookies et sessions"),
      containers: Orbit.tr("Containers", "Conteneurs"),
    }[k];
  },

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
    return out.sort((a, b) => b.size - a.size);
  },

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
      Services.prompt.alert(window, "Orbit", Orbit.tr(`Close ${src.name.split(" · ")[0]} first, then try again.`, `Ferme d'abord ${src.name.split(" · ")[0]}, puis réessaie.`));
      return false;
    }
    const ok = Services.prompt.confirm(window, "Orbit", Orbit.tr("Orbit will create a profile with all your data (bookmarks, history, passwords, cookies and sessions, extensions, containers, tabs) and restart into it. Your current Orbit profile stays available.", "Orbit va créer un profil avec toutes tes données (marque-pages, historique, mots de passe, cookies et sessions, extensions, conteneurs, onglets) puis redémarrer dessus. Ton profil Orbit actuel reste disponible."));
    if (!ok) return false;
    const service = Cc["@mozilla.org/toolkit/profile-service;1"].getService(Ci.nsIToolkitProfileService);
    const profile = service.createProfile(null, `Orbit (${src.name.split(" · ")[0]})`);
    const dest = profile.rootDir.path;
    await IOUtils.makeDirectory(dest, { ignoreExisting: true });
    const steps = [];
    for (const f of [...this.PROFILE_FILES, ...this.PROFILE_DIRS]) {
      if (await IOUtils.exists(PathUtils.join(src.path, f))) steps.push(f);
    }
    const card = this.progressCard(src.name.split(" · ")[0], [Orbit.tr("Copying your data", "Copie de tes données")]);
    for (const [i, f] of steps.entries()) {
      card.detail(`${f} · ${i + 1}/${steps.length}`);
      card.progress(i / steps.length);
      await IOUtils.copy(PathUtils.join(src.path, f), PathUtils.join(dest, f), { recursive: this.PROFILE_DIRS.includes(f) });
    }
    card.progress(1);
    card.mark(0, true);
    await IOUtils.writeUTF8(PathUtils.join(dest, "user.js"),
      `user_pref("orbit.welcome.done", true);\nuser_pref("orbit.user.name", ${JSON.stringify(Orbit.pref("orbit.user.name", ""))});\n` +
      `user_pref("browser.startup.page", 3);\n`);
    service.defaultProfile = profile;
    service.flush();
    card.finish(Orbit.tr("Ready. Restart Orbit to open your data.", "Prêt. Redémarre Orbit pour retrouver tes données."),
      { label: Orbit.tr("Restart", "Redémarrer"), run: () => Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart) });
    return true;
  },

  progressCard(name, labels) {
    const h = Orbit.h.bind(Orbit);
    let stack = document.getElementById("orbit-toasts");
    if (!stack) document.body.append(stack = h("div", { id: "orbit-toasts" }));
    const bar = h("i");
    const detail = h("span", {}, Orbit.tr("Starting…", "Démarrage…"));
    const rows = labels.map(l => h("li", { state: "wait" }, h("span", { class: "orbit-import-dot" }), l));
    const actions = h("div", { class: "orbit-toast-actions" });
    const card = h("div", { class: "orbit-toast orbit-import-progress", role: "status" },
      h("div", { class: "orbit-toast-main" },
        h("span", { class: "orbit-toast-icon" }, Orbit.icon("download")),
        h("div", { class: "orbit-toast-text" }, h("b", {}, `${Orbit.tr("Import", "Import")} · ${name}`), detail),
        h("button", { class: "orbit-toast-close", "aria-label": Orbit.tr("Hide", "Masquer"), onclick: () => card.remove() }, Orbit.icon("x"))),
      h("ul", { class: "orbit-import-steps" }, ...rows),
      h("div", { class: "orbit-turbo-bar" }, bar),
      actions);
    stack.append(card);
    return {
      progress: f => (bar.style.transform = `scaleX(${Math.max(0.02, Math.min(1, f))})`),
      detail: t => (detail.textContent = t),
      start: i => rows[i]?.setAttribute("state", "run"),
      mark: (i, ok) => rows[i]?.setAttribute("state", ok ? "ok" : "fail"),
      finish: (text, action) => {
        detail.textContent = text;
        card.setAttribute("data-tone", "ok");
        if (action) actions.append(h("button", { class: "orbit-toast-b1", onclick: action.run }, action.label));
        else setTimeout(() => card.remove(), 8000);
      },
    };
  },

  async runInBackground(src) {
    const RT = this.MigrationUtils.resourceTypes;
    const types = this.TYPES.filter(([type]) => src.types & RT[type]);
    const card = this.progressCard(src.name, types.map(([, label]) => this.t(label)));
    let done = 0;
    let failed = 0;
    types.forEach((_, i) => card.start(i));
    card.detail(Orbit.tr("Importing in the background, keep browsing.", "Import en arrière-plan, continue à naviguer."));
    try {
      await src.migrator.migrate(src.types, null, src.profile, (type, ok) => {
        const i = types.findIndex(([t]) => RT[t] == type);
        card.mark(i, ok);
        done++;
        if (!ok) failed++;
        card.progress(done / types.length);
      });
    } catch (e) {
      console.error("Orbit import", e);
      failed = types.length - done;
    }
    card.progress(1);
    card.finish(failed ? Orbit.tr("Done, some items could not be imported.", "Terminé, certains éléments n'ont pas pu être importés.")
      : Orbit.tr("Everything was imported.", "Tout a été importé."));
  },

  get l10n() {
    return (this._l10n ??= new Localization(["browser/migrationWizard.ftl", "branding/brand.ftl"]));
  },

  get MigrationUtils() {
    return ChromeUtils.importESModule("resource:///modules/MigrationUtils.sys.mjs").MigrationUtils;
  },

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
          close();
          this.importGeckoProfile(src);
          return;
        }
        close();
        this.runInBackground(src);
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
