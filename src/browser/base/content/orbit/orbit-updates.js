/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Updates. Automatic (Gecko's updater downloads and installs on restart) or
// "ask me": at launch Orbit checks, and if a version is out it shows a window
// with its patch notes (the GitHub release text) and an "Update" button.
// The very first time an update shows up, that window appears even in
// automatic mode, with a box to keep (or stop) automatic updates.
var OrbitUpdates = {
  REPO: "realshavkat/orbit",
  ASKED: "orbit.updates.first-prompt-done",

  t(k) {
    return {
      kicker: Orbit.tr("Update available", "Mise à jour disponible"),
      title: Orbit.tr("Orbit {v} is ready", "Orbit {v} est prête"),
      from: Orbit.tr("You have {v}", "Tu as la {v}"),
      now: Orbit.tr("Update now", "Mettre à jour"),
      later: Orbit.tr("Later", "Plus tard"),
      downloading: Orbit.tr("Downloading… {p}", "Téléchargement… {p}"),
      restart: Orbit.tr("Restart to finish", "Redémarrer pour terminer"),
      failed: Orbit.tr("Download failed. Try again later.", "Le téléchargement a échoué. Réessaie plus tard."),
      notes: Orbit.tr("What's new", "Nouveautés"),
      noNotes: Orbit.tr("Fixes and improvements.", "Corrections et améliorations."),
      auto: Orbit.tr("Install future updates automatically", "Installer automatiquement les prochaines mises à jour"),
      autoD: Orbit.tr("They download in the background and apply when Orbit restarts.", "Elles se téléchargent en arrière-plan et s'appliquent au redémarrage d'Orbit."),
      ready: Orbit.tr("Downloaded. It applies on restart.", "Téléchargée. Elle s'applique au redémarrage."),
    }[k];
  },

  async init() {
    // Firefox's About window becomes Orbit's About page (version and updates).
    window.openAboutDialog = () => OrbitSettings.open("about");
    // One check per launch, from the first window.
    if ([...Services.wm.getEnumerator("navigator:browser")].length > 1) return;
    const first = !Orbit.pref(this.ASKED, false);
    if (!first && await this.isAuto()) return;
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
      if (status == S.DOWNLOAD_AND_INSTALL || status == S.DOWNLOADING || status == S.STAGING || status == S.READY_FOR_RESTART) {
        this.show(updater, status == S.READY_FOR_RESTART ? "ready" : status == S.DOWNLOAD_AND_INSTALL ? "offer" : "downloading");
      }
      if (!this.button) return;
      if (status == S.DOWNLOADING) {
        const [cur, total] = args;
        if (total > 0) this.progress(cur / total);
      } else if (status == S.READY_FOR_RESTART) {
        this.state("ready");
      } else if (status == S.DOWNLOAD_FAILED) {
        this.button.disabled = false;
        this.button.textContent = this.t("failed");
        this.bar.hidden = true;
      }
    });
    await updater.check();
  },

  progress(f) {
    this.bar.hidden = false;
    this.bar.firstChild.style.transform = `scaleX(${Math.min(1, f)})`;
    this.button.textContent = this.t("downloading").replace("{p}", `${Math.round(f * 100)} %`);
  },

  state(kind) {
    if (!this.button) return;
    if (kind == "ready") {
      this.bar.hidden = true;
      this.button.disabled = false;
      this.button.textContent = this.t("restart");
      this.button.onclick = () => Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
      this.status.textContent = this.t("ready");
    } else if (kind == "downloading") {
      this.button.disabled = true;
      this.progress(0);
    }
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

  async show(updater, kind = "offer") {
    if (document.getElementById("orbit-update")) return this.state(kind);
    Services.prefs.setBoolPref(this.ASKED, true);
    const h = Orbit.h.bind(Orbit);
    const version = updater.update?.displayVersion || updater.update?.appVersion || "";
    const md = await this.notes(version);
    const auto = await this.isAuto();
    this.bar = h("div", { class: "orbit-update-bar", hidden: true }, h("i"));
    this.status = h("span", { class: "orbit-update-status" });
    this.button = h("button", { class: "orbit-button primary", onclick: () => {
      this.state("downloading");
      updater.allowUpdateDownload();
    } }, this.t("now"));
    const box = h("input", { type: "checkbox", checked: auto, onchange: () => this.setAuto(box.checked) });
    const close = () => {
      sheet.setAttribute("closing", "true");
      setTimeout(() => sheet.remove(), 180);
      this.button = null;
    };
    const sheet = h("div", { id: "orbit-update", class: "orbit-sheet", onmousedown: e => e.target == sheet && close() },
      h("div", { class: "orbit-sheet-card orbit-update-card", role: "dialog", "aria-label": this.t("kicker") },
        h("div", { class: "orbit-update-head" },
          h("img", { src: "chrome://branding/content/icon64.png", alt: "" }),
          h("div", {},
            h("div", { class: "orbit-update-kicker" }, this.t("kicker")),
            h("div", { class: "orbit-update-title" }, this.t("title").replace("{v}", version)),
            h("div", { class: "orbit-update-versions" },
              h("span", {}, Services.appinfo.version), Orbit.icon("arrow-right"), h("span", { class: "new" }, version)))),
        h("div", { class: "orbit-update-notes" },
          h("div", { class: "orbit-update-label" }, this.t("notes")),
          ...(md ? this.renderNotes(md) : [h("p", {}, this.t("noNotes"))])),
        h("label", { class: "orbit-update-auto" }, box,
          h("span", {}, h("b", {}, this.t("auto")), h("small", {}, this.t("autoD")))),
        this.bar,
        h("div", { class: "orbit-update-actions" },
          this.status,
          h("button", { class: "orbit-button", onclick: close }, this.t("later")),
          this.button)));
    document.body.append(sheet);
    this.state(kind);
  },
};
