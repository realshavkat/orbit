/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const ADD = { fr: "Ajouter à Orbit", es: "Añadir a Orbit", de: "Zu Orbit hinzufügen", pt: "Adicionar ao Orbit",
  it: "Aggiungi a Orbit", ru: "Добавить в Orbit", uk: "Додати до Orbit", en: "Add to Orbit" };
const REMOVE = { fr: "Retirer d'Orbit", es: "Quitar de Orbit", de: "Aus Orbit entfernen", pt: "Remover do Orbit",
  it: "Rimuovi da Orbit", ru: "Удалить из Orbit", uk: "Видалити з Orbit", en: "Remove from Orbit" };
const BUSY = { fr: "Installation…", es: "Instalando…", de: "Wird installiert…", pt: "A instalar…", it: "Installazione…",
  ru: "Установка…", uk: "Встановлення…", en: "Installing…" };

function lang() {
  const l = Services.locale.appLocaleAsBCP47.split("-")[0];
  return l in ADD ? l : "en";
}

export class OrbitStoreChild extends JSWindowActorChild {
  handleEvent(e) {
    if (e.type != "DOMContentLoaded" || this._observer) return;
    const host = this.document.location.host;
    const known = ["zen-browser.app", "addons.mozilla.org", "chromewebstore.google.com", "chrome.google.com"];
    const run = host == "zen-browser.app" ? () => this.zen()
      : host == "addons.mozilla.org" ? () => this.amo()
      : known.includes(host) ? () => this.chrome()
      : () => this.orbit();
    let queued = false;
    this._observer = new this.contentWindow.MutationObserver(() => {
      if (queued) return;
      queued = true;
      this.contentWindow.setTimeout(() => {
        queued = false;
        run();
      }, 150);
    });
    this._observer.observe(this.document.documentElement, { childList: true, subtree: true });
    run();
  }

  didDestroy() {
    this._observer?.disconnect();
  }

  chrome() {
    const id = /\/detail\/(?:[^/]+\/)?([a-p]{32})/.exec(this.document.location.pathname)?.[1];
    if (!id) return;
    const btn = [...this.document.querySelectorAll("button")].find(b =>
      b.hasAttribute("orbit-store") || (b.disabled && /chrome/i.test(b.textContent) && !b.closest("[role=dialog]")));
    if (!btn || btn.getAttribute("orbit-store") == id) return;
    btn.setAttribute("orbit-store", id);
    btn.disabled = false;
    btn.removeAttribute("disabled");
    this.label(btn, ADD[lang()]);
    btn.addEventListener("click", ev => {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (btn.hasAttribute("orbit-busy")) return;
      btn.setAttribute("orbit-busy", "");
      this.label(btn, BUSY[lang()]);
      this.sendQuery("OrbitStore:Chrome", { id }).then(ok => {
        btn.removeAttribute("orbit-busy");
        this.label(btn, ADD[lang()]);
        if (ok) btn.disabled = true;
      });
    }, true);
  }

  amo() {
    for (const el of this.document.querySelectorAll(".AMInstallButton-button, .Button--action, .GetFirefoxButton-button")) {
      const walker = this.document.createTreeWalker(el, 4);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (t.data.includes("Firefox")) t.data = t.data.replace(/Firefox/g, "Orbit");
      }
    }
  }

  zen() {
    const install = this.document.getElementById("install-theme");
    const remove = this.document.getElementById("install-theme-uninstall");
    const id = install?.getAttribute("zen-theme-id");
    if (!id || install.hasAttribute("orbit-store")) return;
    install.setAttribute("orbit-store", id);
    this.document.getElementById("install-theme-error")?.remove();
    const show = installed => {
      install.hidden = installed;
      install.style.setProperty("display", installed ? "none" : "flex", "important");
      if (remove) {
        remove.hidden = !installed;
        remove.style.setProperty("display", installed ? "flex" : "none", "important");
      }
      this.label(install, ADD[lang()]);
      if (remove) this.label(remove, REMOVE[lang()]);
    };
    const act = (name, el) => ev => {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      this.label(el, BUSY[lang()]);
      this.sendQuery(name, { id }).then(show);
    };
    install.addEventListener("click", act("OrbitStore:ModInstall", install), true);
    remove?.addEventListener("click", act("OrbitStore:ModRemove", remove), true);
    this.sendQuery("OrbitStore:ModState", { id }).then(show);
  }

  orbit() {
    this.document.documentElement.setAttribute("data-orbit-browser", "1");
    for (const btn of this.document.querySelectorAll("button[data-orbit-mod]:not([orbit-store])")) {
      const slug = btn.getAttribute("data-orbit-mod");
      btn.setAttribute("orbit-store", slug);
      let installed = false;
      const show = state => {
        if (state == null) return;
        installed = state;
        btn.toggleAttribute("data-orbit-installed", installed);
        this.label(btn, installed ? REMOVE[lang()] : ADD[lang()]);
      };
      btn.addEventListener("click", ev => {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        this.label(btn, BUSY[lang()]);
        this.sendQuery(installed ? "OrbitStore:OrbitModRemove" : "OrbitStore:OrbitModInstall", { slug }).then(show);
      }, true);
      this.sendQuery("OrbitStore:OrbitModState", { slug }).then(show);
    }
  }

  label(btn, text) {
    const walker = this.document.createTreeWalker(btn, 4);
    const nodes = [];
    for (let t = walker.nextNode(); t; t = walker.nextNode()) if (t.data.trim()) nodes.push(t);
    if (!nodes.length) return void (btn.textContent = text);
    nodes[0].data = text;
    for (const t of nodes.slice(1)) t.data = "";
  }
}
