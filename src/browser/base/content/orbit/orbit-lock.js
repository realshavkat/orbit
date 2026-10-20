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
      Orbit.icon("shield-check"), Orbit.tr("Unlock", "Déverrouiller"));
    const error = h("div", { class: "orbit-lock-error" });
    document.body.append(h("div", { id: "orbit-lock" },
      h("div", { class: "orbit-lock-card" },
        h("div", { class: "orbit-lock-icon" }, Orbit.icon("lock")),
        h("div", { class: "orbit-lock-title" }, Orbit.tr("Orbit is locked", "Orbit est verrouillé")),
        h("div", { class: "orbit-lock-text" }, Orbit.tr("Confirm it's you with Windows to continue.", "Confirme que c'est toi avec Windows pour continuer.")),
        button, error)));
    document.documentElement.setAttribute("orbit-locked", "true");
    // Keys go to the lock screen, not to the page.
    button.focus();
  },

  async unlock() {
    const { OSKeyStore } = ChromeUtils.importESModule("resource://gre/modules/OSKeyStore.sys.mjs");
    let ok = false;
    try {
      ok = (await OSKeyStore.ensureLoggedIn(Orbit.tr("unlock Orbit", "déverrouiller Orbit"), "Orbit", window, false)).authenticated;
    } catch {}
    if (!ok) {
      const error = document.querySelector("#orbit-lock .orbit-lock-error");
      if (error) error.textContent = Orbit.tr("Not confirmed. Try again.", "Non confirmé. Réessaie.");
      return;
    }
    for (const win of Services.wm.getEnumerator("navigator:browser")) win.OrbitLock?.hide();
  },

  hide() {
    this.locked = false;
    document.getElementById("orbit-lock")?.remove();
    document.documentElement.removeAttribute("orbit-locked");
    gBrowser.selectedBrowser.focus();
  },
};
