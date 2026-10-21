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
  KEY: "orbit.beta.key",
  UNTIL: "orbit.beta.until",
  DEVICE: "orbit.beta.device",
  GRACE: 14 * 86400,
  ALLOWED: [/^(checkout|js|m|hooks)\.stripe\.com$/, /\.stripe\.network$/, /^accounts\.firefox\.com$/, /\.accounts\.firefox\.com$/],
  state: "ok",
  error: "",

  site() {
    return OrbitPalette.community();
  },

  init() {
    if (!this.site()) return;
    const listener = { onLocationChange: () => this.sync() };
    gBrowser.addProgressListener(listener);
    gBrowser.tabContainer.addEventListener("TabSelect", () => this.sync());
    window.addEventListener("unload", () => gBrowser.removeProgressListener(listener), { once: true });
    if (window == Services.wm.getMostRecentWindow("navigator:browser")) this.check(false);
    else this.sync();
  },

  now: () => Math.floor(Date.now() / 1000),

  device() {
    let id = Orbit.pref(this.DEVICE, "");
    if (!/^[0-9a-f-]{36}$/.test(id)) {
      id = Services.uuid.generateUUID().toString().slice(1, -1);
      Services.prefs.setStringPref(this.DEVICE, id);
    }
    return id;
  },

  normalize(raw) {
    const s = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const body = s.startsWith("ORBIT") ? s.slice(5) : s;
    return /^[A-Z0-9]{20}$/.test(body) ? `ORBIT-${body.match(/.{5}/g).join("-")}` : null;
  },

  messages() {
    return {
      key_invalid: Orbit.tr("This key doesn't exist. Check it and try again.", "Cette clé n'existe pas. Vérifie-la et réessaie."),
      key_revoked: Orbit.tr("This key is no longer valid.", "Cette clé n'est plus valable."),
      key_device_limit: Orbit.tr("This key is already used on the maximum number of devices.", "Cette clé est déjà utilisée sur le nombre maximum d'appareils."),
      offline: Orbit.tr("Orbit's server can't be reached. Check your connection.", "Le serveur d'Orbit ne répond pas. Vérifie ta connexion."),
    };
  },

  async activate(raw) {
    const key = this.normalize(raw);
    if (!key) return { ok: false, error: this.messages().key_invalid };
    Services.prefs.setStringPref(this.KEY, key);
    await this.check(true);
    return { ok: this.state == "ok", error: this.error };
  },

  forget() {
    Services.prefs.clearUserPref(this.KEY);
    Services.prefs.setIntPref(this.UNTIL, 0);
    this.check(true);
  },

  async check(force) {
    const key = Orbit.pref(this.KEY, "");
    if (!force && key && Orbit.pref(this.UNTIL, 0) > this.now()) return this.set("ok");
    if (!key) return this.set("key");
    try {
      const res = await fetch(`${this.site()}/api/v1/license/activate`, {
        method: "POST", credentials: "omit",
        headers: { "content-type": "application/json", "x-orbit-request": "1" },
        body: JSON.stringify({ key, device: this.device() }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.active) {
        Services.prefs.setIntPref(this.UNTIL, this.now() + (body.required ? this.GRACE : 7 * 86400));
        return this.set("ok");
      }
      if (res.status >= 500) throw new Error(`server ${res.status}`);
      Services.prefs.setIntPref(this.UNTIL, 0);
      this.set("key", this.messages()[body.error] ?? this.messages().key_invalid);
    } catch (e) {
      console.warn("Orbit beta check", e);
      if (Orbit.pref(this.UNTIL, 0) > 0) return this.set("ok");
      this.set("key", this.messages().offline);
    }
  },

  set(state, error = "") {
    for (const win of Services.wm.getEnumerator("navigator:browser")) {
      if (!win.OrbitBeta) continue;
      win.OrbitBeta.state = state;
      win.OrbitBeta.error = error;
      win.OrbitBeta.sync(true);
    }
  },

  allowed(uri) {
    if (!uri || !/^https?$/.test(uri.scheme)) return true;
    if (uri.host == new URL(this.site()).hostname) return true;
    return this.ALLOWED.some(re => re.test(uri.host));
  },

  sync(redraw = false) {
    const show = this.state != "ok" && !this.allowed(gBrowser.currentURI);
    const old = document.getElementById("orbit-beta-gate");
    if (!show) return old?.remove();
    if (old && !redraw) return;
    old?.remove();
    const h = Orbit.h.bind(Orbit);
    const site = this.site();
    const open = path => (gBrowser.selectedTab = gBrowser.addTrustedTab(`${site}${path}`));
    const input = h("input", { class: "orbit-input orbit-beta-input", placeholder: "ORBIT-XXXXX-XXXXX-XXXXX-XXXXX", spellcheck: "false",
      "aria-label": Orbit.tr("Beta key", "Clé bêta"), autocomplete: "off", value: Orbit.pref(this.KEY, "") });
    const error = h("div", { class: "orbit-lock-error", role: "alert" }, this.error);
    const go = h("button", { class: "orbit-button primary" }, Orbit.tr("Activate", "Activer"));
    const submit = async () => {
      go.disabled = true;
      error.textContent = "";
      const r = await this.activate(input.value);
      go.disabled = false;
      if (!r.ok) error.textContent = r.error;
    };
    go.addEventListener("click", submit);
    input.addEventListener("keydown", e => e.key == "Enter" && submit());
    document.body.append(h("div", { id: "orbit-beta-gate" },
      h("div", { class: "orbit-lock-card" },
        h("img", { class: "orbit-beta-logo", src: `${Orbit.BASE}orbit-logo.svg`, alt: "" }),
        h("div", { class: "orbit-lock-title" }, Orbit.tr("Welcome to the Orbit beta", "Bienvenue dans la bêta d'Orbit")),
        h("div", { class: "orbit-lock-text" }, Orbit.tr("Enter your beta key to start. You'll find it in your Orbit account after buying or receiving the beta.",
          "Entre ta clé bêta pour commencer. Elle est dans ton compte Orbit après avoir acheté ou reçu la bêta.")),
        h("div", { class: "orbit-beta-form" }, input, go),
        error,
        h("div", { class: "orbit-beta-links" },
          h("button", { class: "orbit-link", onclick: () => open("/beta") }, Orbit.tr("Get a key", "Obtenir une clé")),
          h("span", {}, "·"),
          h("button", { class: "orbit-link", onclick: () => open("/me/payments") }, Orbit.tr("Find my key", "Retrouver ma clé"))))));
    input.focus();
  },
};
