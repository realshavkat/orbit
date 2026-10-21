/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var OrbitPalette = {
  init() {
    window.addEventListener("keydown", e => {
      if (this.recording || e.getModifierState("AltGraph") || !e.ctrlKey || e.altKey) return;
      if (!e.shiftKey && e.code == "KeyK") {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      }
    }, true);
    this.watchSync();
  },

  toggle() {
    if (document.getElementById("orbit-palette")) this.close();
    else this.open();
  },

  cmd(id) {
    const c = document.getElementById(id);
    if (c && !c.hasAttribute("disabled")) c.doCommand();
  },

  community() {
    const url = Orbit.pref("orbit.community.url", "");
    return /^https?:\/\//.test(url) && !PrivateBrowsingUtils.isWindowPrivate(window) ? url.replace(/\/$/, "") : null;
  },

  currentHost() {
    const uri = gBrowser.currentURI;
    return /^https?$/.test(uri?.scheme) ? uri.host.replace(/^www\./, "") : null;
  },

  communityCommands(T) {
    const base = this.community();
    if (!base) return [];
    const open = path => () => openTrustedLinkIn(`${base}${path}`, "tab");
    const host = this.currentHost();
    return [
      ["user", T("My Orbit account", "Mon compte Orbit"), async () => {
        if (this.communitySignedIn() || !(await this.communitySignIn())) open("/me")();
      }],
      ["bell", T("Orbit notifications", "Notifications Orbit"), open("/notifications")],
      ...(host ? [
        ["link", T("Share this site on my profile", "Partager ce site sur mon profil"), open(`/share?domain=${encodeURIComponent(host)}`)],
        ["user", T("Members who shared this site", "Membres qui ont partagé ce site"), open(`/sites/${encodeURIComponent(host)}`)],
      ] : []),
    ];
  },

  watchSync() {
    const topics = ["fxaccounts:onlogin", "fxaccounts:onverified", "fxaccounts:onlogout"];
    const obs = (subject, topic) => {
      if (window != Services.wm.getMostRecentWindow("navigator:browser")) return;
      if (topic == "fxaccounts:onlogout") this.communitySignOut();
      else this.communitySignIn().catch(e => console.error("Orbit account", e));
    };
    for (const t of topics) Services.obs.addObserver(obs, t);
    window.addEventListener("unload", () => topics.forEach(t => Services.obs.removeObserver(obs, t)), { once: true });
  },

  communityHost() {
    const base = this.community();
    return base ? new URL(base).hostname : null;
  },

  communitySignedIn() {
    const host = this.communityHost();
    return !!host && Services.cookies.getCookiesFromHost(host, {}).some(c => c.name == "orbit_session");
  },

  secureCommunity() {
    const base = this.community();
    if (!base) return null;
    const u = new URL(base);
    return u.protocol == "https:" || ["localhost", "127.0.0.1"].includes(u.hostname) ? base : null;
  },

  async communitySignIn() {
    const base = this.secureCommunity();
    if (!base || this._signingIn) return false;
    this._signingIn = true;
    try {
      const { getFxAccountsSingleton } = ChromeUtils.importESModule("resource://gre/modules/FxAccounts.sys.mjs");
      const fxa = getFxAccountsSingleton();
      if (!(await fxa.getSignedInUser())?.verified) return false;
      const token = await fxa.getOAuthToken({ scope: "profile" });
      const res = await fetch(`${base}/api/v1/auth/mozilla`, {
        method: "POST", credentials: "omit",
        headers: { "content-type": "application/json", "x-orbit-request": "1" },
        body: JSON.stringify({ token }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.code) return false;
      openTrustedLinkIn(`${base}/connect#code=${encodeURIComponent(out.code)}`, "tab");
      return true;
    } finally {
      this._signingIn = false;
    }
  },

  communitySignOut() {
    const host = this.communityHost();
    if (host) Services.cookies.removeCookiesFromExactHost(host, "{}");
  },

  recording: false,

  custom() {
    try {
      return JSON.parse(Orbit.pref("orbit.shortcuts", "") || "{}");
    } catch {
      return {};
    }
  },

  setCustom(id, keys) {
    const map = this.custom();
    for (const [k, v] of Object.entries(map)) if (v == keys) delete map[k];
    if (keys) map[id] = keys;
    else delete map[id];
    Services.prefs.setStringPref("orbit.shortcuts", JSON.stringify(map));
  },

  combo(e) {
    if (["Control", "Shift", "Alt", "Meta", "AltGraph"].includes(e.key) || e.getModifierState("AltGraph")) return null;
    const key = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : /^Digit\d$/.test(e.code) ? e.code.slice(5) : e.code == "Space" ? "Espace"
      : { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓" }[e.key] ?? (e.key.length == 1 ? e.key.toUpperCase() : e.key);
    const fKey = /^F\d{1,2}$/.test(key);
    if (!e.ctrlKey && !e.altKey && !fKey) return null;
    return [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Maj", key].filter(Boolean).join(" ");
  },

  flat() {
    return this.commands().flatMap(([, cmds]) => cmds).filter(c => c[4]);
  },

  runShortcut(e) {
    if (this.recording || window.OrbitLock?.locked) return false;
    const map = this.custom();
    if (!Object.keys(map).length) return false;
    const keys = this.combo(e);
    const id = keys && Object.keys(map).find(k => map[k] == keys);
    const command = id && this.flat().find(c => c[4] == id);
    if (!command) return false;
    e.preventDefault();
    e.stopPropagation();
    try {
      command[2]();
    } catch (err) {
      console.error("Orbit shortcut", err);
    }
    return true;
  },

  commands() {
    const ids = new Map();
    const T = (en, fr) => {
      const label = Orbit.tr(en, fr);
      ids.set(label, en);
      return label;
    };
    const tab = () => gBrowser.selectedTab;
    const go = url => switchToTabHavingURI(url, true);
    const settings = id => () => OrbitSettings.open(id);
    const groups = [
      [T("Tabs", "Onglets"), [
        ["plus", T("New tab", "Nouvel onglet"), () => OrbitTabs.openCommandBar(), "Ctrl T"],
        ["app-window", T("New window", "Nouvelle fenêtre"), () => OpenBrowserWindow(), "Ctrl N"],
        ["eye-off", T("New private window", "Nouvelle fenêtre privée"), () => OpenBrowserWindow({ private: true }), "Ctrl Maj P"],
        ["rotate-ccw", T("Reopen closed tab", "Rouvrir l'onglet fermé"), () => this.cmd("History:UndoCloseTab"), "Ctrl Maj T"],
        ["copy", T("Duplicate tab", "Dupliquer l'onglet"), () => (gBrowser.selectedTab = gBrowser.duplicateTab(tab()))],
        ["layers", T("Close duplicate tabs", "Fermer les onglets en double"), () => gBrowser.removeDuplicateTabs(tab())],
        ["columns-2", T("Split view with another tab", "Vue partagée avec un autre onglet"), () => this.cmd("Browser:AddTabSplitView")],
        ["columns-2", T("Split the selected tabs (up to 4)", "Partager l'écran entre les onglets sélectionnés (jusqu'à 4)"), () => OrbitTabs.splitSelected()],
        ["plus", T("Add a page to this split view", "Ajouter une page à la vue partagée"), () => OrbitTabs.addToSplit()],
        ["layers", T("Split view: grid or columns", "Vue partagée : grille ou colonnes"), () => OrbitTabs.toggleSplitGrid()],
        ["pin", T("Pin tab in this space", "Épingler l'onglet dans l'espace"), () => OrbitKept.set(tab(), true)],
        ["star", T("Add to Essentials", "Ajouter aux favoris"), () => gBrowser.pinTab(tab())],
        ["tag", T("Tag this tab", "Mettre un tag sur l'onglet"), () => OrbitExtras.editTag(tab())],
        ["pencil", T("Rename tab", "Renommer l'onglet"), () => OrbitExtras.rename(tab())],
        ["book-open", T("Note on this tab", "Note sur cet onglet"), () => document.getElementById("tab-note-menu")?.openPanel(tab())],
        ["volume-x", T("Mute or unmute tab", "Couper ou remettre le son"), () => tab().toggleMuteAudio(), "Ctrl M"],
        ["moon", T("Put other tabs to sleep", "Mettre les autres onglets en veille"), () => OrbitMemory.sleepAll()],
        ["zap", T("Free memory now", "Libérer la mémoire maintenant"), () => OrbitMemory.freeNow()],
      ]],
      [T("Page", "Page"), [
        ["book-open", T("Reader view", "Mode lecture"), () => this.cmd("View:ReaderView")],
        ["languages", T("Translate page", "Traduire la page"), () => this.cmd("cmd_translate")],
        ["camera", T("Screenshot", "Capture d'écran"), () => this.cmd("Browser:Screenshot"), "Ctrl Maj S"],
        ["picture-in-picture-2", T("Picture-in-Picture", "Picture-in-Picture"), () => this.cmd("View:PictureInPicture")],
        ["picture-in-picture-2", T("Keep page on screen", "Garder la page à l'écran"),
          () => OrbitExtras.reference(gBrowser.currentURI.spec, tab().label, tab().getAttribute("image"))],
        ["printer", T("Print or save as PDF", "Imprimer ou enregistrer en PDF"), () => this.cmd("cmd_print"), "Ctrl P"],
        ["search", T("Find in page", "Rechercher dans la page"), () => this.cmd("cmd_find"), "Ctrl F"],
        ["bookmark", T("Bookmark page", "Ajouter la page aux marque-pages"), () => this.cmd("Browser:AddBookmarkAs"), "Ctrl D"],
        ["link", T("Copy link", "Copier le lien"), () => OrbitExtras.copy(gBrowser.currentURI.spec)],
        ["app-window", T("Install as an app", "Installer comme application"), () => this.installApp()],
        ["shield", T("Clear this site's cookies and data", "Effacer les cookies et données de ce site"), () => this.clearSite()],
        ["info", T("Site permissions and info", "Permissions et infos du site"), () => this.cmd("View:PageInfo"), "Ctrl I"],
        ["code-xml", T("View source", "Code source de la page"), () => this.cmd("View:PageSource"), "Ctrl U"],
      ]],
      [T("AI", "IA"), [
        ["bot", T("Open the assistant", "Ouvrir l'assistant"), () => OrbitAI.toggleAssistant(), "Ctrl Maj U"],
        ["sparkles", T("Summarize this page", "Résumer cette page"), () => OrbitAI.askTabs([tab()], "summary")],
        ["layers", T("Compare the selected tabs", "Comparer les onglets sélectionnés"), () => OrbitAI.askTabs(this.chosenTabs(), "compare")],
        ["bot", T("Ask about the selected tabs…", "Poser une question sur les onglets sélectionnés…"), () => OrbitAI.askTabs(this.chosenTabs(), "ask")],
      ]],
      [T("Orbit", "Orbit"), [
        ...this.communityCommands(T),
        ["layers", T("New space", "Nouvel espace"), () => OrbitSpaces.edit(null)],
        ...OrbitSpaces.spaces.map((s, i) => ["layers", `${T("Go to space", "Aller à l'espace")} ${s.name}`,
          () => OrbitSpaces.switchTo(s.id), i < 9 ? `Alt ${i + 1}` : undefined]),
        ["pipette", T("Color picker (pipette)", "Pipette à couleurs"), () => OrbitPicker.start()],
        ["palette", T("Quick colors", "Couleurs rapides"), () => OrbitColors.open(document.getElementById("orbit-space-title"))],
        ["eye", T("Focus mode", "Mode concentration"), () => OrbitLayout.toggleFocus(), "Ctrl Maj F"],
        ["panel-left", T("Compact mode", "Mode compact"), () => OrbitLayout.toggleCompact(), "Ctrl Alt C"],
        ["shield-check", T("Lock Orbit", "Verrouiller Orbit"), () => OrbitLock.lock(), "Ctrl Alt L"],
        ["download", T("Save this session", "Enregistrer la session"), () => OrbitSessions.saveAsk()],
        ["history", T("Restore a session…", "Restaurer une session…"), () => OrbitSettings.open("sessions")],
        ["wand-sparkles", T("Edit Orbit", "Modifier Orbit"), () => OrbitEdit.enter()],
        ["settings-2", T("Settings", "Paramètres"), settings(), "Ctrl ,"],
        ["sparkles", T("Mods", "Mods"), settings("mods")],
        ["gauge", T("Memory and performance", "Mémoire et performances"), () => OrbitMemory.open()],
        ["activity", T("Task manager", "Gestionnaire des tâches"), () => this.cmd("View:AboutProcesses"), "Maj Échap"],
        ["user", T("Profiles", "Profils"), () => this.cmd("Profiles:ManageProfiles")],
        ["refresh-cw", T("Sync", "Synchronisation"), () => openPreferences("sync")],
      ]],
      [T("Open", "Ouvrir"), [
        ["download", T("Downloads", "Téléchargements"), () => go(OrbitDownloads.PAGE), "Ctrl J"],
        ["history", T("History", "Historique"), () => PlacesCommandHook.showPlacesOrganizer("History"), "Ctrl H"],
        ["bookmark", T("Bookmarks", "Marque-pages"), () => PlacesCommandHook.showPlacesOrganizer("AllBookmarks")],
        ["shield", T("Passwords", "Mots de passe"), () => go("about:logins")],
        ["shield-check", T("Privacy dashboard", "Tableau de bord de confidentialité"), () => go("about:protections")],
        ["puzzle", T("Extensions", "Extensions"), () => BrowserAddonUI.openAddonsMgr("addons://list/extension"), "Ctrl Maj A"],
        ["upload", T("Import from another browser", "Importer depuis un autre navigateur"), () => OrbitImport.open()],
        ["trash-2", T("Clear browsing data", "Effacer les données de navigation"), () => this.cmd("Tools:Sanitize"), "Ctrl Maj Suppr"],
        ["code", T("Developer tools", "Outils de développement"), () => document.getElementById("key_toggleToolbox")?.doCommand?.() ?? this.cmd("View:PageSource"), "F12"],
      ]],
    ];
    const custom = this.custom();
    return groups.map(([title, cmds]) => [title, cmds.map(([icon, label, run, keys]) => {
      const id = ids.get(label);
      return [icon, label, run, custom[id] ?? keys, id];
    })]);
  },

  chosenTabs() {
    const sel = gBrowser.selectedTabs;
    if (sel.length > 1) return sel;
    return OrbitSpaces.tabsIn(OrbitSpaces.activeId).slice(0, 6);
  },

  async clearSite() {
    const host = gBrowser.currentURI?.host;
    if (!host) return;
    const { SiteDataManager } = ChromeUtils.importESModule("resource:///modules/SiteDataManager.sys.mjs");
    await SiteDataManager.remove(host);
    gBrowser.reload();
    OrbitNotify.show({ kind: "site-data", icon: "shield", tone: "ok", title: host, timeout: 3000,
      text: Orbit.tr("Cookies and site data cleared.", "Cookies et données du site effacés.") });
  },

  async installApp() {
    try {
      const { TaskbarTabs } = ChromeUtils.importESModule("resource:///modules/taskbartabs/TaskbarTabs.sys.mjs");
      await TaskbarTabs.moveTabIntoTaskbarTab(gBrowser.selectedTab);
    } catch (e) {
      console.error("Orbit: install app", e);
    }
  },

  norm(s) {
    return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  },

  matches(text, words) {
    const t = this.norm(text);
    return words.every(w => t.includes(w));
  },

  async places(q) {
    if (q.length < 2) return { bookmarks: [], history: [] };
    const db = await PlacesUtils.promiseDBConnection();
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const pick = rows => rows.map(r => ({ url: r.getResultByName("url"), title: r.getResultByName("title") || r.getResultByName("url") }));
    const bookmarks = pick(await db.executeCached(
      `SELECT h.url, b.title FROM moz_bookmarks b JOIN moz_places h ON h.id = b.fk
       WHERE b.type = 1 AND (b.title LIKE :q ESCAPE '\\' OR h.url LIKE :q ESCAPE '\\') ORDER BY h.frecency DESC LIMIT 6`, { q: like }));
    const history = pick(await db.executeCached(
      `SELECT url, title FROM moz_places WHERE hidden = 0 AND last_visit_date NOT NULL
       AND (title LIKE :q ESCAPE '\\' OR url LIKE :q ESCAPE '\\') ORDER BY frecency DESC LIMIT 8`, { q: like }));
    return { bookmarks, history };
  },

  keyName(k) {
    if (Orbit.lang() == "fr") return k;
    return { Maj: "Shift", "Échap": "Esc", Suppr: "Del", "Entrée": "Enter", Espace: "Space", clic: "click" }[k] ?? k;
  },

  ask(placeholder, onDone, { secret = false } = {}) {
    this.open({ placeholder, onDone, secret });
  },

  open({ placeholder, onDone, secret } = {}) {
    document.getElementById("orbit-palette")?.remove();
    const h = Orbit.h.bind(Orbit);
    const input = h("input", { class: "op-input", placeholder: placeholder ?? Orbit.tr("Search actions, tabs, bookmarks, history…",
      "Rechercher une action, un onglet, un favori, l'historique…"), spellcheck: "false", "aria-label": placeholder ?? "Orbit",
      type: secret ? "password" : "text" });
    const list = h("div", { class: "op-list", role: "listbox" });
    const root = h("div", { id: "orbit-palette", onmousedown: e => e.target == root && this.close() },
      h("div", { class: "op-card", role: "dialog" },
        h("label", { class: "op-head" }, Orbit.icon("search"), input, h("kbd", {}, "Esc")), list,
        h("div", { class: "op-foot" }, h("span", {}, h("kbd", {}, "↑↓"), Orbit.tr(" move", " naviguer")),
          h("span", {}, h("kbd", {}, this.keyName("Entrée")), onDone ? Orbit.tr(" confirm", " valider") : Orbit.tr(" open", " ouvrir")))));
    if (onDone) {
      root.setAttribute("ask", "true");
      input.addEventListener("keydown", e => {
        e.stopPropagation();
        if (e.key == "Enter") {
          this.close();
          onDone(input.value.trim());
        } else if (e.key == "Escape") {
          this.close();
        }
      });
      document.body.append(root);
      input.focus();
      return;
    }
    const groups = this.commands();
    let items = [];
    let active = 0;
    let seq = 0;
    const pick = i => {
      active = Math.max(0, Math.min(items.length - 1, i));
      items.forEach((it, j) => it.el.toggleAttribute("active", j == active));
      items[active]?.el.scrollIntoView({ block: "nearest" });
    };
    const run = it => {
      this.close();
      try {
        it.run();
      } catch (e) {
        console.error("Orbit palette", e);
      }
    };
    const render = async () => {
      const mine = ++seq;
      const raw = input.value.trim();
      const words = this.norm(raw).split(/\s+/).filter(Boolean);
      const sections = [];
      const row = (icon, title, sub, runIt, keys) => ({ icon, title, sub, run: runIt, keys });
      if (words.length) {
        const tabs = gBrowser.tabs.filter(t => !t.closing && this.matches(`${t.label} ${t.linkedBrowser.currentURI.spec}`, words)).slice(0, 8)
          .map(t => row(t.getAttribute("image") || "icons/globe.svg", t.label,
            OrbitSpaces.byId(OrbitSpaces.spaceOf(t))?.name ?? (t.pinned ? Orbit.tr("Pinned", "Épinglé") : ""), () => (gBrowser.selectedTab = t)));
        if (tabs.length) sections.push([Orbit.tr("Open tabs", "Onglets ouverts"), tabs]);
      }
      for (const [title, cmds] of groups) {
        const found = cmds.filter(([, label]) => !words.length || this.matches(`${label} ${title}`, words))
          .map(([icon, label, fn, keys]) => row(icon, label, "", fn, keys));
        if (found.length) sections.push([title, words.length ? found.slice(0, 6) : found]);
      }
      if (words.length) {
        const closed = SessionStore.getClosedTabDataForWindow(window).map((c, i) => ({ c, i }))
          .filter(({ c }) => this.matches(`${c.title} ${c.state?.entries?.at(-1)?.url}`, words)).slice(0, 4)
          .map(({ c, i }) => row("rotate-ccw", c.title, Orbit.tr("Closed", "Fermé"), () => undoCloseTab(i)));
        if (closed.length) sections.push([Orbit.tr("Recently closed", "Fermés récemment"), closed]);
        const sessions = (await OrbitSessions.list()).filter(s => this.matches(s.name, words))
          .map(s => row("history", s.name, OrbitSessions.describe(s), () => OrbitSessions.restore(s.id)));
        if (sessions.length) sections.push([Orbit.tr("Sessions", "Sessions"), sessions]);
        const { bookmarks, history } = await this.places(raw);
        if (mine != seq) return;
        const open = url => () => openTrustedLinkIn(url, "tab");
        if (bookmarks.length) sections.push([Orbit.tr("Bookmarks", "Marque-pages"), bookmarks.map(b => row("bookmark", b.title, b.url, open(b.url)))]);
        if (history.length) sections.push([Orbit.tr("History", "Historique"), history.map(b => row("history", b.title, b.url, open(b.url)))]);
      }
      if (mine != seq) return;
      items = [];
      list.replaceChildren(...sections.flatMap(([title, rows]) => [h("div", { class: "op-section" }, title), ...rows.map(r => {
        const img = r.icon.includes("/") || r.icon.includes(":") ? h("img", { class: "op-favicon", src: r.icon.startsWith("icons/") ? Orbit.BASE + r.icon : r.icon, alt: "" })
          : Orbit.icon(r.icon);
        const el = h("button", { class: "op-item", role: "option", onclick: () => run(r), onmousemove: () => pick(items.indexOf(it)) },
          img, h("span", { class: "op-title" }, r.title), r.sub ? h("span", { class: "op-sub" }, r.sub) : null,
          r.keys ? h("span", { class: "op-keys" }, ...r.keys.split(" ").map(k => h("kbd", {}, this.keyName(k)))) : null);
        const it = { ...r, el };
        items.push(it);
        return el;
      })]));
      if (!items.length) list.append(h("div", { class: "op-empty" }, Orbit.tr("Nothing found.", "Aucun résultat.")));
      pick(0);
    };
    input.addEventListener("input", render);
    input.addEventListener("keydown", e => {
      if (e.key == "ArrowDown") pick(active + 1);
      else if (e.key == "ArrowUp") pick(active - 1);
      else if (e.key == "Enter" && items[active]) run(items[active]);
      else if (e.key == "Escape") this.close();
      else return;
      e.preventDefault();
      e.stopPropagation();
    });
    document.body.append(root);
    render();
    input.focus();
  },

  close() {
    const root = document.getElementById("orbit-palette");
    if (!root) return;
    root.setAttribute("closing", "true");
    setTimeout(() => root.remove(), 140);
  },
};

var OrbitForum = {
  async maybeOpen() {
    if (!Orbit.pref("orbit.forum.onStartup", true) || !Orbit.pref("orbit.welcome.done", false)) return;
    if ([...Services.wm.getEnumerator("navigator:browser")].length > 1) return;
    const base = OrbitPalette.community();
    if (!base) return;
    await SessionStore.promiseAllWindowsRestored.catch(() => {});
    if (window.closed) return;
    const url = `${base}/forum`;
    const tab = gBrowser.tabs.find(t => t.linkedBrowser?.currentURI?.spec.startsWith(url));
    gBrowser.selectedTab = tab ?? gBrowser.addTab(`${url}?from=orbit`, { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
  },
};
