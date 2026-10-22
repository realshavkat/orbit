/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var OrbitAccount = {
  COLORS: { violet: "#7c86ff", blue: "#4f8cff", cyan: "#22c3e6", green: "#3ddc97", amber: "#f5c518", orange: "#ff9f43", rose: "#ff6bcb", red: "#ff5d5d", slate: "#8a8a99" },
  ROLES: { owner: ["Owner", "Propriétaire", "#f5c518"], administrator: ["Admin", "Admin", "#ff8d97"], moderator: ["Moderator", "Modérateur", "#3dd68c"] },

  base() {
    return OrbitPalette.community();
  },

  async api(path, { method = "GET", body } = {}) {
    const base = this.base();
    if (!base) throw Object.assign(new Error("no_community"), { code: "no_community" });
    let res;
    try {
      res = await fetch(`${base}/api/v1${path}`, {
        method, credentials: "include", cache: "no-store",
        headers: { "x-orbit-request": "1", ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw Object.assign(new Error("network"), { code: "network" });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `http_${res.status}`), { code: data.error, status: res.status });
    return data;
  },

  async me(force = false) {
    if (!force && this._me && Date.now() - this._me.at < 60_000) return this._me.value;
    try {
      const value = await this.api("/me");
      this._me = { at: Date.now(), value };
      return value;
    } catch (e) {
      if (e.status != 401) throw e;
      this._me = { at: Date.now(), value: null };
      return null;
    }
  },

  forget() {
    this._me = null;
  },

  open(path) {
    const base = this.base();
    if (!base) return;
    OrbitSettings.close();
    openTrustedLinkIn(`${base}${path}`, "tab");
  },

  media(id) {
    return id ? `${this.base() ?? ""}/api/v1/users/media/${id}` : null;
  },

  blob(url) {
    this._blobs ??= new Map();
    if (!this._blobs.has(url)) {
      if (this._blobs.size >= 200) {
        const [oldest, src] = this._blobs.entries().next().value;
        this._blobs.delete(oldest);
        src.then(u => URL.revokeObjectURL(u), () => {});
      }
      this._blobs.set(url, fetch(url, { credentials: "include", cache: "force-cache" })
        .then(r => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then(b => URL.createObjectURL(b))
        .catch(e => {
          this._blobs.delete(url);
          throw e;
        }));
    }
    return this._blobs.get(url);
  },

  paint(el, url) {
    if (!url) return el;
    this.blob(url).then(src => {
      el.style.backgroundImage = `url("${src}")`;
      el.setAttribute("loaded", "true");
    }).catch(() => {});
    return el;
  },

  avatar(user, size = 32) {
    const h = Orbit.h.bind(Orbit);
    const url = user?.avatar_url ? `${this.base() ?? ""}${user.avatar_url}` : this.media(user?.avatar_media_id);
    const style = `width:${size}px;height:${size}px;--c:${this.COLORS[user?.theme_color] ?? this.COLORS.violet};font-size:${Math.round(size * 0.4)}px`;
    return this.paint(h("span", { class: "orbit-avatar", style }, h("span", {}, (user?.display_name || user?.username || "?")[0].toUpperCase())), url);
  },

  async fxa() {
    try {
      const { getFxAccountsSingleton } = ChromeUtils.importESModule("resource://gre/modules/FxAccounts.sys.mjs");
      return { service: getFxAccountsSingleton(), user: await getFxAccountsSingleton().getSignedInUser() };
    } catch {
      return { service: null, user: null };
    }
  },

  async linkMozilla() {
    const { service, user } = await this.fxa();
    if (!user) throw Object.assign(new Error("fxa_signed_out"), { code: "fxa_signed_out" });
    if (!user.verified) throw Object.assign(new Error("fxa_unverified"), { code: "fxa_unverified" });
    const token = await service.getOAuthToken({ scope: "profile" });
    const { code } = await this.api("/auth/mozilla", { method: "POST", body: { token } });
    const out = await this.api("/auth/mozilla/redeem", { method: "POST", body: { code } });
    this.forget();
    return out;
  },

  async signOut() {
    await this.api("/auth/logout", { method: "POST", body: {} }).catch(() => {});
    OrbitPalette.communitySignOut();
    this.forget();
    OrbitSitePeople.refresh(true);
  },

  svg(name, size = 16) {
    return Orbit.h("img", { class: "orbit-icon", src: `${Orbit.BASE}icons/${name}.svg`, alt: "", style: `width:${size}px;height:${size}px` });
  },

  renderSettings() {
    const h = Orbit.h.bind(Orbit);
    const root = h("div", { class: "orbit-account" }, h("div", { class: "orbit-account-loading" }, h("span", { class: "orbit-spinner" })));
    this.fill(root);
    return root;
  },

  async fill(root) {
    const h = Orbit.h.bind(Orbit);
    const tr = Orbit.tr.bind(Orbit);
    if (!this.base()) {
      root.replaceChildren(h("div", { class: "orbit-account-empty" }, this.svg("user", 22),
        h("p", {}, tr("Orbit accounts are not available in this window.", "Le compte Orbit n'est pas disponible dans cette fenêtre."))));
      return;
    }
    let me;
    try {
      me = await this.me(true);
    } catch {
      root.replaceChildren(h("div", { class: "orbit-account-empty" }, this.svg("globe", 22),
        h("p", {}, tr("Orbit's site cannot be reached right now.", "Le site d'Orbit ne répond pas pour le moment.")),
        h("button", { class: "orbit-button", onclick: () => this.fill(root) }, tr("Try again", "Réessayer"))));
      return;
    }
    if (!me) return root.replaceChildren(this.signedOut());
    const [beta, threads, sites, mods, unread] = await Promise.all([
      this.api("/beta").catch(() => null),
      this.api(`/forum/threads?sort=new&author=${encodeURIComponent(me.username)}`).catch(() => null),
      this.api("/sites/mine").catch(() => null),
      this.api("/mods/mine").catch(() => null),
      this.api("/notifications/count").catch(() => null),
    ]);
    root.replaceChildren(
      this.hero(me, { threads: threads?.total ?? 0, sites: sites?.sites?.length ?? 0 }, root),
      h("div", { class: "orbit-account-grid" }, this.keyCard(beta), this.shortcuts(me, { threads: threads?.total ?? 0, mods: mods?.mods ?? [], unread: unread?.unread ?? 0 })),
      await this.syncCard(me, root),
      this.visibility(me));
  },

  signedOut() {
    const h = Orbit.h.bind(Orbit);
    const tr = Orbit.tr.bind(Orbit);
    const perk = (icon, title, text) => h("div", { class: "orbit-account-perk" }, this.svg(icon, 18), h("b", {}, title), h("span", {}, text));
    return h("div", { class: "orbit-account-out" },
      h("span", { class: "orbit-account-mark" }, h("img", { src: `${Orbit.BASE}orbit-logo.svg`, alt: "" })),
      h("div", { class: "orbit-account-out-text" },
        h("h2", {}, tr("Connect your Orbit account", "Connecte ton compte Orbit")),
        h("p", {}, tr("The same account as on the site. Orbit recognises it as soon as you are signed in.",
          "Le même compte que sur le site. Orbit le reconnaît tout seul dès que tu es connecté."))),
      h("div", { class: "orbit-account-perks" },
        perk("key-round", tr("Your beta key", "Ta clé bêta"), tr("Activated on this device in one click.", "Activée en un clic sur cet appareil.")),
        perk("users", tr("People on sites", "Les gens sur les sites"), tr("See who is around, if you want.", "Vois qui est là, si tu le veux.")),
        perk("message-square", tr("Forum and profile", "Forum et profil"), tr("Your badges, mods and threads.", "Tes badges, tes mods, tes discussions."))),
      h("div", { class: "orbit-account-actions" },
        h("button", { class: "orbit-button primary", onclick: () => this.open("/login?next=/me") }, tr("Sign in", "Se connecter")),
        h("button", { class: "orbit-button", onclick: () => this.open("/register") }, tr("Create an account", "Créer un compte"))),
      h("button", { class: "orbit-link", onclick: async () => {
        const { user } = await this.fxa();
        if (user?.verified) OrbitPalette.communitySignIn();
        else (OrbitSettings.close(), openPreferences("paneSync"));
      } }, tr("Continue with Firefox Sync", "Continuer avec Firefox Sync")));
  },

  hero(me, stats, root) {
    const h = Orbit.h.bind(Orbit);
    const tr = Orbit.tr.bind(Orbit);
    const role = (me.roles ?? []).map(r => this.ROLES[r]).find(Boolean);
    const banner = this.media(me.banner_media_id);
    const bannerEl = h("div", { class: "orbit-account-banner" }, banner ? null : h("span", { class: "orbit-account-rings" }));
    const since = new Intl.DateTimeFormat(Orbit.lang(), { month: "long", year: "numeric" }).format(new Date(me.created_at));
    const stat = (n, one, many) => h("span", {}, h("b", {}, String(n)), ` ${n == 1 ? one : many}`);
    return h("section", { class: "orbit-account-hero", style: `--c:${this.COLORS[me.theme_color] ?? this.COLORS.violet}` },
      this.paint(bannerEl, banner),
      h("div", { class: "orbit-account-id" },
        this.avatar(me, 84),
        h("div", { class: "orbit-account-who" },
          h("div", { class: "orbit-account-name" }, h("b", {}, me.display_name || me.username),
            role ? h("span", { class: "orbit-account-role", style: `--r:${role[2]}` }, Orbit.tr(role[0], role[1])) : null),
          h("span", {}, `@${me.username} · ${tr("member since", "membre depuis")} ${since}`),
          h("div", { class: "orbit-account-stats" },
            stat(me.badges?.length ?? 0, "badge", "badges"),
            stat(stats.threads, tr("thread", "discussion"), tr("threads", "discussions")),
            stat(stats.sites, tr("favorite site", "site favori"), tr("favorite sites", "sites favoris")))),
        h("div", { class: "orbit-account-actions" },
          h("button", { class: "orbit-button", onclick: () => this.open(`/u/${me.username}`) }, tr("View my profile", "Voir mon profil")),
          h("button", { class: "orbit-button primary", onclick: () => this.open("/me") }, tr("Edit my profile", "Modifier mon profil"), this.svg("external-link", 13)),
          h("button", { class: "orbit-icon-button orbit-account-out-btn", title: tr("Sign out", "Se déconnecter"),
            onclick: async () => (await this.signOut(), this.fill(root)) }, this.svg("log-out", 15)))));
  },

  keyCard(beta) {
    const h = Orbit.h.bind(Orbit);
    const tr = Orbit.tr.bind(Orbit);
    const local = OrbitBeta.normalize(Orbit.pref(OrbitBeta.KEY, ""));
    const remote = beta?.key?.key ?? null;
    const key = remote ?? local;
    const here = !!key && key == local && OrbitBeta.state == "ok";
    const card = h("section", { class: "orbit-account-card orbit-account-key" },
      h("header", {}, h("h3", {}, this.svg("key-round", 16), tr("Beta key", "Clé bêta")),
        key ? h("span", { class: `orbit-account-pill${here ? " ok" : ""}` }, h("i"), here ? tr("Active here", "Active ici") : tr("Not on this device", "Pas sur cet appareil")) : null));
    const enter = () => {
      const value = { value: "" };
      if (!Services.prompt.prompt(window, "Orbit", tr("Your Orbit beta key:", "Ta clé bêta Orbit :"), value, null, {})) return;
      OrbitBeta.activate(value.value).then(r => (r.ok ? OrbitSettings.show("account") : Services.prompt.alert(window, "Orbit", r.error)));
    };
    if (!key) {
      const staff = beta?.staff || !beta?.paywall;
      card.append(h("p", { class: "orbit-account-muted" }, staff
        ? tr("No key needed for your account.", "Aucune clé n'est nécessaire pour ton compte.")
        : tr("Your key appears here once you have the beta.", "Ta clé apparaît ici une fois que tu as la bêta.")),
      h("div", { class: "orbit-account-actions start" },
        staff ? null : h("button", { class: "orbit-button primary", onclick: () => this.open("/beta") }, tr("Get the beta", "Obtenir la bêta")),
        h("button", { class: "orbit-button", onclick: enter }, tr("Enter a key", "Entrer une clé"))));
      return card;
    }
    const hidden = `${key.slice(0, 11)}-•••••-•••••-${key.slice(-5)}`.replace(/--/g, "-");
    const code = h("code", {}, hidden);
    const eye = h("button", { class: "orbit-icon-button", title: tr("Show the key", "Afficher la clé"), onclick: () => {
      const shown = code.textContent == key;
      code.textContent = shown ? hidden : key;
      eye.replaceChildren(this.svg(shown ? "eye" : "eye-off", 15));
    } }, this.svg("eye", 15));
    card.append(h("div", { class: "orbit-account-keybox" }, code, eye,
      h("button", { class: "orbit-icon-button", title: tr("Copy", "Copier"), onclick: () => OrbitExtras.copy(key) }, this.svg("copy", 15))));
    if (beta?.key) {
      const used = beta.key.devices;
      const max = beta.key.max_devices;
      card.append(h("div", { class: "orbit-account-devices" },
        h("span", {}, tr("Devices", "Appareils"), " · ", h("b", {}, tr(`${used} of ${max}`, `${used} sur ${max}`))),
        h("span", { class: "orbit-account-meter" }, ...Array.from({ length: max }, (_, i) => h("i", { on: i < used })))));
    }
    card.append(h("div", { class: "orbit-account-actions start" },
      remote && !here ? h("button", { class: "orbit-button primary", onclick: async e => {
        e.currentTarget.disabled = true;
        const r = await OrbitBeta.activate(remote);
        if (!r.ok) Services.prompt.alert(window, "Orbit", r.error);
        OrbitSettings.show("account");
      } }, tr("Use on this device", "Utiliser sur cet appareil")) : null,
      h("button", { class: "orbit-link", onclick: () => this.open("/me/payments") }, tr("Manage my devices on the site", "Gérer mes appareils sur le site")),
      remote ? null : h("button", { class: "orbit-link", onclick: enter }, tr("Change", "Changer"))));
    return card;
  },

  async syncCard(me, root) {
    const h = Orbit.h.bind(Orbit);
    const tr = Orbit.tr.bind(Orbit);
    const { user } = await this.fxa();
    const status = h("span", { class: "orbit-account-muted" });
    const card = h("section", { class: "orbit-account-card orbit-account-sync" },
      h("header", {}, h("h3", {}, this.svg("refresh-cw", 16), "Firefox Sync"),
        h("span", { class: `orbit-account-pill${me.mozilla_linked ? " ok" : ""}` }, h("i"),
          me.mozilla_linked ? tr("Linked to Orbit", "Lié à Orbit") : user ? tr("Not linked", "Pas lié") : tr("Signed out", "Déconnecté"))));
    const manage = h("button", { class: "orbit-button", onclick: () => (OrbitSettings.close(), openPreferences("paneSync")) },
      user ? tr("Manage sync", "Gérer la synchronisation") : tr("Sign in to Firefox Sync", "Se connecter à Firefox Sync"));
    const link = async btn => {
      if (btn) btn.disabled = true;
      status.textContent = tr("Linking…", "Liaison…");
      try {
        const out = await this.linkMozilla();
        if (out.needs_username) status.textContent = tr("Finish on the site.", "Termine sur le site.");
        Services.prefs.setBoolPref("orbit.account.mozilla-linked", true);
        this.fill(root);
      } catch (e) {
        status.textContent = {
          mozilla_already_linked: tr("Your Orbit account is already linked to another Firefox account.", "Ton compte Orbit est déjà lié à un autre compte Firefox."),
          fxa_unverified: tr("Confirm your Mozilla e-mail first.", "Confirme d'abord ton e-mail Mozilla."),
          email_in_use: tr("This e-mail is used by an unconfirmed Orbit account.", "Cet e-mail est utilisé par un compte Orbit non confirmé."),
        }[e.code] ?? tr("Could not link the accounts. Try again.", "Impossible de lier les comptes. Réessaie.");
        if (btn) btn.disabled = false;
      }
    };
    let text;
    if (!user) text = tr("Sign in to Firefox Sync to sync bookmarks, passwords and tabs. Your Orbit account is linked automatically.",
      "Connecte-toi à Firefox Sync pour synchroniser favoris, mots de passe et onglets. Ton compte Orbit y sera lié automatiquement.");
    else if (me.mozilla_linked) text = tr(`Signed in as ${user.email}. Signing in to Firefox Sync on another PC signs you in to Orbit there too.`,
      `Connecté en tant que ${user.email}. Te connecter à Firefox Sync sur un autre PC t'y connecte aussi à Orbit.`);
    else text = tr(`Signed in as ${user.email}. Link it so Firefox Sync signs you in to Orbit everywhere.`,
      `Connecté en tant que ${user.email}. Lie-le pour que Firefox Sync te connecte à Orbit partout.`);
    const linkBtn = user && !me.mozilla_linked ? h("button", { class: "orbit-button primary", onclick: e => link(e.currentTarget) }, tr("Link to my Orbit account", "Lier à mon compte Orbit")) : null;
    card.append(h("p", { class: "orbit-account-muted" }, text), h("div", { class: "orbit-account-actions start" }, linkBtn, manage), status);
    if (linkBtn && user.verified && !this._autoLinked) {
      this._autoLinked = true;
      link(linkBtn);
    }
    return card;
  },

  shortcuts(me, { threads, mods, unread }) {
    const h = Orbit.h.bind(Orbit);
    const tr = Orbit.tr.bind(Orbit);
    const pending = mods.filter(m => m.latest?.status == "pending").length;
    const tile = (icon, title, sub, path, badge) => h("button", { class: "orbit-account-tile", onclick: () => this.open(path) },
      h("span", { class: "orbit-account-tile-top" }, this.svg(icon, 17), badge ? h("span", { class: "orbit-account-badge" }, String(badge)) : null),
      h("b", {}, title), h("span", {}, sub));
    return h("section", { class: "orbit-account-tiles" },
      tile("bell", tr("Notifications", "Notifications"), unread ? tr(`${unread} new`, `${unread} nouvelle${unread > 1 ? "s" : ""}`) : tr("All read", "Tout est lu"), "/notifications", unread),
      tile("message-square", tr("My threads", "Mes discussions"), tr(`${threads} in the forum`, `${threads} dans le forum`), "/forum/mine"),
      tile("sparkles", tr("My mods", "Mes mods"), pending ? tr(`${pending} in review`, `${pending} en vérification`) : tr(`${mods.length} published`, `${mods.length} publié${mods.length > 1 ? "s" : ""}`), "/mods/mine"),
      tile("lock", tr("Security", "Sécurité"), me.mfa_enabled ? tr("Two-step on", "Validation en 2 étapes") : tr("Turn on two-step", "Active la validation en 2 étapes"), "/me/security"));
  },

  visibility(me) {
    const h = Orbit.h.bind(Orbit);
    const tr = Orbit.tr.bind(Orbit);
    const p = me.privacy ?? {};
    const row = (icon, tone, title, desc, on, change) => h("div", { class: "orbit-account-row" },
      h("span", { class: "orbit-account-chip", style: `--t:${tone}` }, this.svg(icon, 16)),
      h("div", {}, h("b", {}, title), h("span", {}, desc)),
      OrbitSettings.switch(on, change));
    const server = key => async on => {
      try {
        await this.api("/me/privacy", { method: "PATCH", body: { [key]: on } });
        p[key] = on;
        this.forget();
        if (key == "share_presence" || key == "share_sites_enabled") OrbitSitePeople.refresh(true);
      } catch {
        Services.prompt.alert(window, "Orbit", tr("Could not save this setting.", "Impossible d'enregistrer ce réglage."));
        OrbitSettings.show("account");
      }
    };
    const rows = [
      row("users", "#b7bdff", tr("People on this site", "Les gens sur ce site"),
        tr("A button beside the address bar shows who is on the site, who passed by and who has it as a favorite.",
          "Un bouton à côté de la barre d'adresse montre qui est sur le site, qui y est passé et qui l'a en favori."),
        Orbit.pref(OrbitSitePeople.PREF, true), on => Services.prefs.setBoolPref(OrbitSitePeople.PREF, on)),
      row("radio", "#3dd68c", tr("Show my presence", "Montrer ma présence"),
        tr("Members see that you are on a site: the domain only, never the page. Never for sensitive sites. Turning it off erases everything.",
          "Les membres voient que tu es sur un site : le domaine seulement, jamais la page. Jamais pour les sites sensibles. Désactiver efface tout."),
        !!p.share_presence, server("share_presence")),
      row("star", "#f5c518", tr("Favorite sites on my profile", "Sites favoris sur mon profil"),
        tr("Sites you add appear on your profile and in the site's favorites.", "Les sites que tu ajoutes apparaissent sur ton profil et dans les favoris du site."),
        !!p.share_sites_enabled, server("share_sites_enabled")),
      row("eye", "#c9ccd8", tr("Public profile", "Profil public"), tr("Off: only your name is visible.", "Désactivé : seul ton nom est visible."),
        !!p.profile_public, server("profile_public")),
      row("compass", "#c9ccd8", tr("Appear in suggestions", "Apparaître dans les suggestions"),
        tr("Other members can find you in People.", "Les autres membres peuvent te trouver dans Membres."), !!p.discoverable, server("discoverable")),
    ];
    return h("section", { class: "orbit-account-card orbit-account-vis" }, h("h3", {}, tr("What others see", "Ce que les autres voient")), ...rows);
  },
};

var OrbitSitePeople = {
  PREF: "orbit.sites.people",
  HEARTBEAT: 120_000,

  init() {
    if (!OrbitAccount.base() || this.button) return;
    const box = document.getElementById("page-action-buttons");
    if (!box) return;
    const h = Orbit.h.bind(Orbit);
    this.faces = h("span", { class: "orbit-people-faces" });
    this.count = h("span", { class: "orbit-people-count" });
    this.button = h("div", { id: "orbit-people-button", class: "urlbar-page-action", role: "button", tabindex: "0", hidden: true,
      onclick: e => (e.stopPropagation(), this.toggle()),
      onkeydown: e => (e.key == "Enter" || e.key == " ") && (e.preventDefault(), this.toggle()) },
    Orbit.icon("users", "orbit-icon orbit-people-icon"), this.faces, this.count);
    const stop = box.querySelector("toolbartabstop");
    if (stop) stop.after(this.button);
    else box.prepend(this.button);
    this.cache = new Map();
    this.sent = new Map();
    this._update = () => this.schedule();
    gBrowser.tabContainer.addEventListener("TabSelect", this._update);
    this._progress = { onLocationChange: (b, p, r, uri, flags) => !(flags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT) && this.schedule() };
    gBrowser.addProgressListener(this._progress);
    Services.prefs.addObserver(this.PREF, this._update);
    this._beat = setInterval(() => this.heartbeat(), this.HEARTBEAT);
    window.addEventListener("unload", () => {
      clearInterval(this._beat);
      Services.prefs.removeObserver(this.PREF, this._update);
      gBrowser.removeProgressListener(this._progress);
    }, { once: true });
    this.schedule();
  },

  host() {
    const host = OrbitPalette.currentHost();
    if (!host || host == OrbitPalette.communityHost()?.replace(/^www\./, "")) return null;
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host) ? host.toLowerCase() : null;
  },

  schedule() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.refresh(), 500);
  },

  async refresh(force = false) {
    if (!this.button) return;
    if (force) this.cache.clear();
    const host = this.host();
    if (!host || !Orbit.pref(this.PREF, true)) return this.show(null);
    const me = await OrbitAccount.me(force).catch(() => null);
    if (!me || this.host() != host) return this.show(null);
    if (me.privacy?.share_presence) this.report(host);
    let data = this.cache.get(host);
    if (!data || Date.now() - data.at > 60_000) {
      data = await OrbitAccount.api(`/sites/people?domain=${encodeURIComponent(host)}`).then(d => ({ ...d, at: Date.now() })).catch(() => null);
      if (data) this.cache.set(host, data);
    }
    if (this.host() == host) this.show(data);
  },

  report(host, again = false) {
    const last = this.sent.get(host) ?? 0;
    if (!again && Date.now() - last < 60_000) return;
    this.sent.set(host, Date.now());
    OrbitAccount.api("/sites/presence", { method: "POST", body: { domain: host } }).catch(() => {});
  },

  heartbeat() {
    if (Services.focus.activeWindow != window) return;
    const host = this.host();
    if (host && OrbitAccount._me?.value?.privacy?.share_presence && Orbit.pref(this.PREF, true)) this.report(host, true);
  },

  everyone(d) {
    const seen = new Set();
    return [...d.here, ...d.recent, ...d.favorites].filter(u => !seen.has(u.id) && seen.add(u.id));
  },

  show(data) {
    this.data = data;
    if (!data || data.sensitive) {
      this.button.hidden = true;
      this.close();
      return;
    }
    const people = this.everyone(data);
    this.button.hidden = false;
    this.button.toggleAttribute("live", data.here.length > 0);
    this.button.toggleAttribute("empty", !people.length);
    this.faces.replaceChildren(...(data.here.length ? data.here : people).slice(0, 3).map(u => OrbitAccount.avatar(u, 18)));
    this.count.textContent = data.here.length ? String(data.here.length) : people.length ? String(people.length) : "";
    const label = Orbit.tr(`People on this site: ${data.here.length} here, ${data.recent.length} recently, ${data.favorites.length} favorites`,
      `Les gens sur ce site : ${data.here.length} ici, ${data.recent.length} récemment, ${data.favorites.length} favoris`);
    this.button.setAttribute("tooltiptext", label);
    this.button.setAttribute("aria-label", label);
    if (this.panel) this.renderPanel();
  },

  toggle() {
    if (this.panel) return this.close();
    if (!this.data) return;
    const h = Orbit.h.bind(Orbit);
    this.panel = h("div", { id: "orbit-people-panel", role: "dialog", "aria-label": Orbit.tr(`People on ${this.data.domain}`, `Les gens sur ${this.data.domain}`) });
    document.body.append(this.panel);
    this.tab = this.data.here.length ? "here" : this.data.recent.length ? "recent" : "favorites";
    this.renderPanel();
    const r = this.button.getBoundingClientRect();
    const width = 360;
    this.panel.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, r.right - width + 40))}px`;
    this.panel.style.top = `${Math.round(r.bottom + 10)}px`;
    this._outside = e => !this.panel?.contains(e.target) && !this.button.contains(e.target) && this.close();
    this._esc = e => e.key == "Escape" && this.close();
    window.addEventListener("mousedown", this._outside, true);
    window.addEventListener("keydown", this._esc, true);
  },

  close() {
    if (!this.panel) return;
    window.removeEventListener("mousedown", this._outside, true);
    window.removeEventListener("keydown", this._esc, true);
    const panel = this.panel;
    this.panel = null;
    panel.setAttribute("closing", "true");
    setTimeout(() => panel.remove(), 140);
  },

  ago(d) {
    const s = (Date.now() - new Date(d)) / 1000;
    const rtf = new Intl.RelativeTimeFormat(Orbit.lang(), { numeric: "auto" });
    if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), "minute");
    if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
    return rtf.format(-Math.round(s / 86400), "day");
  },

  renderPanel() {
    const h = Orbit.h.bind(Orbit);
    const tr = Orbit.tr.bind(Orbit);
    const d = this.data;
    const me = OrbitAccount._me?.value;
    const lists = { here: d.here, recent: d.recent, favorites: d.favorites };
    const tabs = [["here", tr("Here", "Ici"), d.here.length], ["recent", tr("Recently", "Récemment"), d.recent.length], ["favorites", tr("Favorites", "Favoris"), d.favorites.length]];
    const list = lists[this.tab] ?? [];
    const empty = {
      here: tr("Nobody here right now.", "Personne ici pour l'instant."),
      recent: tr("Nobody passed by recently.", "Personne n'est passé récemment."),
      favorites: tr("Nobody has this site as a favorite yet.", "Personne n'a encore ce site en favori."),
    }[this.tab];
    const total = this.everyone(d).length;
    const favicon = gBrowser.selectedTab.getAttribute("image");
    const presence = OrbitSettings.switch(!!me?.privacy?.share_presence, async on => {
      await OrbitAccount.api("/me/privacy", { method: "PATCH", body: { share_presence: on } }).catch(() => null);
      OrbitAccount.forget();
      await OrbitAccount.me(true).catch(() => null);
      this.refresh(true);
    });
    const fav = h("button", { class: `orbit-button ${d.shared_by_me ? "" : "primary"} orbit-people-fav`, onclick: async () => {
      fav.disabled = true;
      try {
        if (d.shared_by_me) await OrbitAccount.api(`/sites/shared/${encodeURIComponent(d.domain)}`, { method: "DELETE" });
        else {
          if (!me?.privacy?.share_sites_enabled) await OrbitAccount.api("/me/privacy", { method: "PATCH", body: { share_sites_enabled: true } });
          await OrbitAccount.api("/sites/shared", { method: "POST", body: { domain: d.domain } });
        }
        OrbitAccount.forget();
        await OrbitAccount.me(true).catch(() => null);
      } catch {}
      this.refresh(true);
    } }, OrbitAccount.svg(d.shared_by_me ? "check" : "star", 15),
    d.shared_by_me ? tr(`${d.domain} is in my favorites`, `${d.domain} est dans mes favoris`) : tr(`Add ${d.domain} to my favorites`, `Ajouter ${d.domain} à mes favoris`));
    this.panel.replaceChildren(
      h("header", { class: "orbit-people-head" },
        h("span", { class: "orbit-people-site" }, favicon ? h("img", { src: favicon, alt: "" }) : OrbitAccount.svg("globe", 16)),
        h("div", {}, h("b", {}, d.domain),
          h("small", {}, total ? tr(`${total} member${total > 1 ? "s" : ""} linked to this site`, `${total} membre${total > 1 ? "s" : ""} lié${total > 1 ? "s" : ""} à ce site`)
            : tr("No member linked to this site yet", "Aucun membre lié à ce site pour l'instant"))),
        h("button", { class: "orbit-icon-button", title: tr("Close", "Fermer"), onclick: () => this.close() }, OrbitAccount.svg("x", 15))),
      h("div", { class: "orbit-people-tabs", role: "tablist" }, ...tabs.map(([k, label, n]) => h("button", {
        role: "tab", "aria-selected": String(k == this.tab), on: k == this.tab,
        onclick: () => ((this.tab = k), this.renderPanel()),
      }, k == "here" ? h("i", { class: "orbit-people-dot" }) : null, label, h("span", {}, String(n))))),
      list.length ? h("div", { class: "orbit-people-list" }, ...list.map((u, i) => h("button", {
        class: "orbit-people-row", style: `animation-delay:${i * 25}ms`, onclick: () => (this.close(), OrbitAccount.open(`/u/${u.username}`)),
      }, h("span", { class: "orbit-people-face", here: this.tab == "here" }, OrbitAccount.avatar(u, 36)),
      h("span", { class: "orbit-people-who" }, h("b", {}, u.display_name || u.username),
        h("small", {}, u.seen_at && this.tab != "favorites" ? `@${u.username} · ${this.ago(u.seen_at)}` : `@${u.username}`)),
      OrbitAccount.svg("chevron-right", 15))))
        : h("div", { class: "orbit-people-empty" }, OrbitAccount.svg(this.tab == "favorites" ? "star" : "users", 20), h("span", {}, empty)),
      h("div", { class: "orbit-people-presence" },
        h("div", {}, h("b", {}, tr("Show my presence", "Montrer ma présence")), h("small", {}, tr("The domain only, never the page.", "Le domaine seulement, jamais la page."))),
        presence),
      h("div", { class: "orbit-people-foot" }, fav));
  },
};
