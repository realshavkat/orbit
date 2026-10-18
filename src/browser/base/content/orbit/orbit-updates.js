/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Updates. Automatic (Gecko's updater downloads and installs on restart) or
// "ask me": at launch Orbit checks, and if a version is out it shows a sheet
// with its patch notes (the GitHub release text) and an "Update" button.
var OrbitUpdates = {
  REPO: "realshavkat/orbit",

  t(k) {
    const fr = Orbit.lang() == "fr";
    return {
      kicker: fr ? "MISE À JOUR" : "UPDATE",
      title: fr ? "Orbit {v} est" : "Orbit {v} is",
      key: fr ? "disponible" : "available",
      now: fr ? "Mettre à jour" : "Update now",
      later: fr ? "Plus tard" : "Later",
      downloading: fr ? "Téléchargement… {p}" : "Downloading… {p}",
      restart: fr ? "Redémarrer pour terminer" : "Restart to finish",
      failed: fr ? "Le téléchargement a échoué. Réessaie plus tard." : "Download failed. Try again later.",
      notes: fr ? "Nouveautés" : "What's new",
      noNotes: fr ? "Corrections et améliorations." : "Fixes and improvements.",
      current: fr ? "Tu as la version {v}." : "You have version {v}.",
    }[k];
  },

  async init() {
    // One check per launch, from the first window.
    if ([...Services.wm.getEnumerator("navigator:browser")].length > 1) return;
    if (await this.isAuto()) return;
    setTimeout(() => this.check().catch(e => console.error("Orbit updates", e)), 5000);
  },

  get UpdateUtils() {
    return ChromeUtils.importESModule("resource://gre/modules/UpdateUtils.sys.mjs").UpdateUtils;
  },

  async isAuto() {
    try {
      return await this.UpdateUtils.getAppUpdateAutoEnabled();
    } catch {
      return true;
    }
  },

  async setAuto(on) {
    try {
      await this.UpdateUtils.setAppUpdateAutoEnabled(on);
    } catch (e) {
      console.error("Orbit updates", e);
    }
  },

  async check() {
    const { AppUpdater } = ChromeUtils.importESModule("resource://gre/modules/AppUpdater.sys.mjs");
    const updater = (this.updater = new AppUpdater());
    const S = AppUpdater.STATUS;
    updater.addListener((status, ...args) => {
      if (status == S.DOWNLOAD_AND_INSTALL) this.show(updater);
      else if (status == S.DOWNLOADING && this.button) {
        const [cur, total] = args;
        if (total > 0) this.button.textContent = this.t("downloading").replace("{p}", `${Math.round((cur / total) * 100)} %`);
      } else if (status == S.READY_FOR_RESTART && this.button) {
        this.button.disabled = false;
        this.button.textContent = this.t("restart");
        this.button.onclick = () => Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
      } else if (status == S.DOWNLOAD_FAILED && this.button) {
        this.button.textContent = this.t("failed");
      }
    });
    await updater.check();
  },

  // Patch notes: the body of the GitHub release for that version.
  async notes(version) {
    try {
      const res = await fetch(`https://api.github.com/repos/${this.REPO}/releases/tags/${encodeURIComponent(version)}`,
        { credentials: "omit", headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) return "";
      return String((await res.json()).body ?? "").slice(0, 6000);
    } catch {
      return "";
    }
  },

  // Tiny Markdown subset -> DOM (text only, never HTML): headings, bullets, paragraphs.
  renderNotes(md) {
    const h = Orbit.h.bind(Orbit);
    const out = [];
    let list = null;
    for (const raw of md.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) {
        list = null;
        continue;
      }
      const bullet = /^[-*•]\s+(.*)$/.exec(line);
      if (bullet) {
        if (!list) out.push((list = h("ul")));
        list.append(h("li", {}, bullet[1].replace(/\*\*|__|`/g, "")));
        continue;
      }
      list = null;
      const heading = /^#{1,6}\s+(.*)$/.exec(line);
      out.push(heading ? h("h4", {}, heading[1]) : h("p", {}, line.replace(/\*\*|__|`/g, "")));
    }
    return out;
  },

  async show(updater) {
    if (document.getElementById("orbit-update")) return;
    const h = Orbit.h.bind(Orbit);
    const version = updater.update?.displayVersion || updater.update?.appVersion || "";
    const md = await this.notes(version);
    this.button = h("button", { class: "orbit-toast-b1", onclick: () => {
      this.button.disabled = true;
      this.button.textContent = this.t("downloading").replace("{p}", "");
      updater.allowUpdateDownload();
    } }, this.t("now"));
    const close = () => {
      sheet.setAttribute("closing", "true");
      setTimeout(() => sheet.remove(), 180);
    };
    const sheet = h("div", { id: "orbit-update", class: "orbit-sheet", onmousedown: e => e.target == sheet && close() },
      h("div", { class: "orbit-sheet-card orbit-update-card" },
        h("div", { class: "orbit-update-head" },
          h("img", { src: "chrome://branding/content/icon64.png", alt: "" }),
          h("div", {},
            h("div", { class: "orbit-sheet-kicker" }, this.t("kicker")),
            h("div", { class: "orbit-update-title" }, `${this.t("title").replace("{v}", version)} `, h("span", { class: "orbit-key" }, this.t("key"))),
            h("div", { class: "orbit-setting-desc" }, this.t("current").replace("{v}", Services.appinfo.version)))),
        h("div", { class: "orbit-update-notes" },
          h("div", { class: "orbit-sheet-kicker" }, this.t("notes")),
          ...(md ? this.renderNotes(md) : [h("p", {}, this.t("noNotes"))])),
        h("div", { class: "orbit-update-actions" },
          h("button", { class: "orbit-toast-b2", onclick: close }, this.t("later")),
          this.button)));
    document.body.append(sheet);
  },
};
