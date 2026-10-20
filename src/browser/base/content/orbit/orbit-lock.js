/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Lock: an opaque screen over every Orbit window, opened with Windows
// (PIN, face, fingerprint or password). Ctrl+Alt+L, after some idle time,
// or at startup. It hides the windows; it does not encrypt the profile.
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
    // Keys go to the lock screen, not to the page.
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
    // A Windows account without a password confirms anyone: the Orbit PIN is required then.
    if (/no_password|unsupported/.test(result.auth_details ?? "")) {
      if (this.hasPin()) return this.error(Orbit.tr("This Windows account has no password: use your Orbit PIN.", "Ce compte Windows n'a pas de mot de passe : utilise ton code PIN Orbit."));
    }
    this.unlockAll();
  },

  // ---- Orbit PIN: PBKDF2-SHA-256 in orbit.lock.pin ("salt:hash", hex) ----------------
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
    // Same work whatever the input, then a full-length comparison.
    let diff = got.length ^ hash.length;
    for (let i = 0; i < hash.length; i++) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i);
    return diff == 0;
  },

  // Five wrong PINs in a row: wait 30 s before the next try.
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
