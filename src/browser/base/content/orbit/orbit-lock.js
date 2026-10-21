/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var OrbitLock = {
  locked: false,

  init() {
    window.addEventListener("keydown", e => {
      if (!e.getModifierState("AltGraph") && e.ctrlKey && e.altKey && !e.shiftKey && e.code == "KeyL") {
        e.preventDefault();
        e.stopPropagation();
        this.lockAll();
      } else if (this.locked && !e.target.closest?.("#orbit-lock")) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
    const others = [...Services.wm.getEnumerator("navigator:browser")].filter(w => w != window);
    if (others.some(w => w.OrbitLock?.locked)) this.show();
    else if (!others.length && Orbit.pref("orbit.lock.on-start", false)) this.show();
    this.watchIdle();
    Services.prefs.addObserver("orbit.lock.idle-minutes", this);
    window.addEventListener("unload", () => {
      Services.prefs.removeObserver("orbit.lock.idle-minutes", this);
      this.unwatchIdle();
    }, { once: true });
  },

  get idle() {
    return Cc["@mozilla.org/widget/useridleservice;1"].getService(Ci.nsIUserIdleService);
  },

  watchIdle() {
    this.unwatchIdle();
    const minutes = Orbit.pref("orbit.lock.idle-minutes", 0);
    if (minutes <= 0) return;
    this._idleSeconds = minutes * 60;
    this.idle.addIdleObserver(this, this._idleSeconds);
  },

  unwatchIdle() {
    if (!this._idleSeconds) return;
    this.idle.removeIdleObserver(this, this._idleSeconds);
    this._idleSeconds = 0;
  },

  observe(_subject, topic) {
    if (topic == "idle") this.lockAll();
    else if (topic == "nsPref:changed") this.watchIdle();
  },

  lockAll() {
    for (const win of Services.wm.getEnumerator("navigator:browser")) win.OrbitLock?.show();
  },

  lock() {
    this.lockAll();
  },

  show() {
    if (this.locked) return;
    this.locked = true;
    const h = Orbit.h.bind(Orbit);
    const button = h("button", { class: "orbit-button orbit-lock-unlock", onclick: () => this.unlock() },
      Orbit.icon("shield-check"), Orbit.tr("Unlock with Windows", "Déverrouiller avec Windows"));
    const pin = this.hasPin()
      ? h("input", { class: "orbit-input orbit-lock-pin", type: "password", placeholder: Orbit.tr("Orbit PIN", "Code PIN Orbit"),
        "aria-label": Orbit.tr("Orbit PIN", "Code PIN Orbit"), autocomplete: "off" })
      : null;
    pin?.addEventListener("keydown", e => e.key == "Enter" && this.unlockWithPin(pin));
    document.body.append(h("div", { id: "orbit-lock" },
      h("div", { class: "orbit-lock-card" },
        h("div", { class: "orbit-lock-icon" }, Orbit.icon("lock")),
        h("div", { class: "orbit-lock-title" }, Orbit.tr("Orbit is locked", "Orbit est verrouillé")),
        h("div", { class: "orbit-lock-text" }, pin
          ? Orbit.tr("Enter your Orbit PIN or confirm it's you with Windows.", "Entre ton code PIN Orbit ou confirme que c'est toi avec Windows.")
          : Orbit.tr("Confirm it's you with Windows to continue.", "Confirme que c'est toi avec Windows pour continuer.")),
        pin, button, h("div", { class: "orbit-lock-error" }))));
    document.documentElement.setAttribute("orbit-locked", "true");
    (pin ?? button).focus();
  },

  error(text) {
    const el = document.querySelector("#orbit-lock .orbit-lock-error");
    if (el) el.textContent = text;
  },

  async unlock() {
    const { OSKeyStore } = ChromeUtils.importESModule("resource://gre/modules/OSKeyStore.sys.mjs");
    let result = null;
    try {
      result = await OSKeyStore.ensureLoggedIn(Orbit.tr("unlock Orbit", "déverrouiller Orbit"), "Orbit", window, false);
    } catch {}
    if (!result?.authenticated) return this.error(Orbit.tr("Not confirmed. Try again.", "Non confirmé. Réessaie."));
    if (/no_password|unsupported/.test(result.auth_details ?? "")) {
      if (this.hasPin()) return this.error(Orbit.tr("This Windows account has no password: use your Orbit PIN.", "Ce compte Windows n'a pas de mot de passe : utilise ton code PIN Orbit."));
    }
    this.unlockAll();
  },

  hasPin() {
    return /^[0-9a-f]+:[0-9a-f]+$/.test(Orbit.pref("orbit.lock.pin", ""));
  },

  async hash(pin, saltHex) {
    const salt = Uint8Array.from(saltHex.match(/../g), b => parseInt(b, 16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 200000 }, key, 256);
    return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
  },

  async setPin(pin) {
    if (!pin) return Services.prefs.clearUserPref("orbit.lock.pin");
    const salt = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
    Services.prefs.setStringPref("orbit.lock.pin", `${salt}:${await this.hash(pin, salt)}`);
  },

  async checkPin(pin) {
    const [salt, hash] = Orbit.pref("orbit.lock.pin", "").split(":");
    if (!salt || !hash) return false;
    const got = await this.hash(pin, salt);
    let diff = got.length ^ hash.length;
    for (let i = 0; i < hash.length; i++) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i);
    return diff == 0;
  },

  async unlockWithPin(input) {
    if (Date.now() < (this._waitUntil ?? 0)) {
      return this.error(Orbit.tr("Too many tries. Wait a moment.", "Trop d'essais. Attends un peu."));
    }
    const ok = await this.checkPin(input.value);
    input.value = "";
    if (ok) {
      this._fails = 0;
      return this.unlockAll();
    }
    this._fails = (this._fails ?? 0) + 1;
    if (this._fails >= 5) {
      this._fails = 0;
      this._waitUntil = Date.now() + 30_000;
    }
    this.error(Orbit.tr("Wrong PIN.", "Code PIN incorrect."));
  },

  unlockAll() {
    for (const win of Services.wm.getEnumerator("navigator:browser")) win.OrbitLock?.hide();
  },

  hide() {
    this.locked = false;
    document.getElementById("orbit-lock")?.remove();
    document.documentElement.removeAttribute("orbit-locked");
    gBrowser.selectedBrowser.focus();
  },
};

var OrbitBeta = {
  UNTIL: "orbit.beta.until",
  GRACE: 14 * 86400,
  ALLOWED: [/^accounts\.firefox\.com$/, /\.accounts\.firefox\.com$/, /^(checkout|js|m|hooks)\.stripe\.com$/, /\.stripe\.network$/],
  state: "ok",

  site() {
    const url = OrbitPalette.community();
    if (!url) return null;
    const u = new URL(url);
    return u.protocol == "https:" || ["localhost", "127.0.0.1"].includes(u.hostname) ? url : null;
  },

  init() {
    if (!this.site()) return;
    const topics = ["fxaccounts:onverified", "fxaccounts:onlogin", "fxaccounts:onlogout"];
    const obs = (s, topic) => (topic == "fxaccounts:onlogout" ? this.set("signin") : this.check(true));
    for (const t of topics) Services.obs.addObserver(obs, t);
    const listener = { onLocationChange: () => this.sync() };
    gBrowser.addProgressListener(listener);
    gBrowser.tabContainer.addEventListener("TabSelect", () => this.sync());
    window.addEventListener("unload", () => {
      topics.forEach(t => Services.obs.removeObserver(obs, t));
      gBrowser.removeProgressListener(listener);
    }, { once: true });
    this.check(false);
  },

  now: () => Math.floor(Date.now() / 1000),

  async check(force) {
    if (!force && Orbit.pref(this.UNTIL, 0) > this.now()) return this.set("ok");
    const site = this.site();
    try {
      const { getFxAccountsSingleton } = ChromeUtils.importESModule("resource://gre/modules/FxAccounts.sys.mjs");
      const fxa = getFxAccountsSingleton();
      if (!(await fxa.getSignedInUser())?.verified) return this.set("signin");
      const token = await fxa.getOAuthToken({ scope: "profile" });
      const call = (path, init = {}) => fetch(`${site}/api/v1${path}`, { credentials: "omit", ...init,
        headers: { "content-type": "application/json", "x-orbit-request": "1", ...(init.headers ?? {}) } }).then(r => r.json().then(b => ({ ok: r.ok, body: b })));
      const auth = await call("/auth/mozilla", { method: "POST", body: JSON.stringify({ token, client: "app" }) });
      if (auth.body.needs_username) return this.set("account");
      if (!auth.ok || !auth.body.session) return this.set("signin");
      const bearer = { authorization: `Bearer ${auth.body.session}` };
      const lic = await call("/license", { headers: bearer });
      call("/auth/logout", { method: "POST", headers: bearer, body: "{}" }).catch(() => {});
      if (!lic.ok) return this.set("signin");
      if (!lic.body.active) return this.set("pay");
      Services.prefs.setIntPref(this.UNTIL, this.now() + (lic.body.required ? this.GRACE : 7 * 86400));
      this.set("ok");
    } catch (e) {
      console.warn("Orbit beta check", e);
      this.set(Orbit.pref(this.UNTIL, 0) > 0 ? "ok" : "offline");
    }
  },

  set(state) {
    if (state != "ok" && state != "offline") Services.prefs.setIntPref(this.UNTIL, 0);
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (win.OrbitBeta) {
        win.OrbitBeta.state = state;
        win.OrbitBeta.sync();
      }
    }
  },

  allowed(uri) {
    if (!uri || !/^https?$/.test(uri.scheme)) return true;
    const site = new URL(this.site());
    if (uri.host == site.hostname) return true;
    return this.ALLOWED.some(re => re.test(uri.host));
  },

  sync() {
    const show = this.state != "ok" && !this.allowed(gBrowser.currentURI);
    const el = document.getElementById("orbit-beta-gate");
    if (!show) return el?.remove();
    if (el?.dataset.state == this.state) return;
    el?.remove();
    const h = Orbit.h.bind(Orbit);
    const site = this.site();
    const open = url => (gBrowser.selectedTab = gBrowser.addTrustedTab(url));
    const texts = {
      signin: [Orbit.tr("Sign in to start the Orbit beta", "Connecte-toi pour lancer la bêta d'Orbit"),
        Orbit.tr("Sign in to Firefox Sync with the account that has beta access.", "Connecte-toi à Firefox Sync avec le compte qui a l'accès bêta."),
        [[Orbit.tr("Sign in to Firefox Sync", "Se connecter à Firefox Sync"), () => openPreferences("paneSync"), true]]],
      account: [Orbit.tr("Create your Orbit account", "Crée ton compte Orbit"),
        Orbit.tr("Your Mozilla account isn't linked to an Orbit account yet.", "Ton compte Mozilla n'est pas encore lié à un compte Orbit."),
        [[Orbit.tr("Create my account", "Créer mon compte"), () => OrbitPalette.communitySignIn(), true], [Orbit.tr("Check again", "Vérifier à nouveau"), () => this.check(true)]]],
      pay: [Orbit.tr("Get the Orbit beta", "Obtiens la bêta d'Orbit"),
        Orbit.tr("The beta is a small one-time purchase. Orbit becomes free for everyone at version 1.0.", "La bêta est un petit achat, une seule fois. Orbit devient gratuit pour tous à la version 1.0."),
        [[Orbit.tr("Get beta access", "Obtenir l'accès bêta"), () => open(`${site}/beta`), true], [Orbit.tr("I've paid, check again", "J'ai payé, vérifier"), () => this.check(true)]]],
      offline: [Orbit.tr("Can't check your beta access", "Impossible de vérifier ton accès bêta"),
        Orbit.tr("Orbit's server can't be reached. Check your connection.", "Le serveur d'Orbit ne répond pas. Vérifie ta connexion."),
        [[Orbit.tr("Try again", "Réessayer"), () => this.check(true), true]]],
    };
    const [title, text, actions] = texts[this.state];
    document.body.append(h("div", { id: "orbit-beta-gate", "data-state": this.state },
      h("div", { class: "orbit-lock-card" },
        h("img", { class: "orbit-beta-logo", src: `${Orbit.BASE}orbit-logo.svg`, alt: "" }),
        h("div", { class: "orbit-lock-title" }, title),
        h("div", { class: "orbit-lock-text" }, text),
        h("div", { class: "orbit-beta-actions" }, ...actions.map(([label, fn, primary]) =>
          h("button", { class: `orbit-button${primary ? " primary" : ""}`, onclick: fn }, label))))));
  },
};
