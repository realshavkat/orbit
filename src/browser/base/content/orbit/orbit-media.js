/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Sidebar mini player: the media playing in another tab (title, artist,
// artwork) with previous / play-pause / next, via the platform's
// MediaController. Hovering it shows a seek bar and a volume bar. Event-driven:
// the only timer runs while the card is hovered and something plays.
var OrbitMedia = {
  init() {
    if (!Orbit.pref("orbit.media.sidebar-player", true)) return;
    try {
      ChromeUtils.registerWindowActor("OrbitMedia", {
        parent: { esModuleURI: "resource://orbit/actors/OrbitMediaParent.sys.mjs" },
        child: { esModuleURI: "resource://orbit/actors/OrbitMediaChild.sys.mjs" },
        allFrames: true,
        messageManagerGroups: ["browsers"],
        // The parent only sends volume queries; it never trusts the child.
        safeForUntrustedWebProcess: true,
      });
    } catch {}
    const h = Orbit.h.bind(Orbit);
    this.seek = this.bar(f => {
      const d = this.pos?.duration;
      if (d > 0) {
        this.ctl()?.seekTo(f * d);
        this.pos = { ...this.pos, position: f * d, at: performance.now() };
        this.tick();
      }
    });
    this.volume = this.bar(f => this.setVolume(f));
    this.timeNow = h("span", { class: "orbit-media-time" });
    this.timeEnd = h("span", { class: "orbit-media-time" });
    this.muteBtn = h("button", { class: "orbit-icon-button orbit-media-mute", "aria-label": Orbit.tr("Mute", "Couper le son"),
      onclick: () => this.tab?.toggleMuteAudio() }, Orbit.icon("volume-2"));
    this.card = h("div", { id: "orbit-media", hidden: true },
      h("div", { class: "orbit-media-row" },
        this.art = h("img", { class: "orbit-media-art", alt: "" }),
        h("button", { class: "orbit-media-text", onclick: () => this.tab && (gBrowser.selectedTab = this.tab) },
          this.title = h("span", { class: "orbit-media-title" }),
          this.sub = h("span", { class: "orbit-media-sub" })),
        h("button", { class: "orbit-icon-button", "aria-label": Orbit.tr("Previous", "Précédent"), onclick: () => this.ctl()?.prevTrack() }, Orbit.icon("skip-back")),
        this.playBtn = h("button", { class: "orbit-icon-button", "aria-label": Orbit.tr("Play", "Lecture"), onclick: () => this.toggle() }, Orbit.icon("pause")),
        h("button", { class: "orbit-icon-button", "aria-label": Orbit.tr("Next", "Suivant"), onclick: () => this.ctl()?.nextTrack() }, Orbit.icon("skip-forward"))),
      h("div", { class: "orbit-media-more" }, h("div", {},
        this.seekRow = h("div", { class: "orbit-media-seek" }, this.timeNow, this.seek.el, this.timeEnd),
        h("div", { class: "orbit-media-vol" }, this.muteBtn, this.volume.el))));
    this.card.addEventListener("mouseenter", () => {
      this.hover = true;
      this.readVolume();
      this.tick();
    });
    this.card.addEventListener("mouseleave", () => {
      this.hover = false;
      clearInterval(this.timer);
      this.timer = 0;
    });
    const footer = document.getElementById("orbit-sidebar-footer");
    footer.parentNode.insertBefore(this.card, footer);
    gBrowser.tabContainer.addEventListener("TabAttrModified", e => {
      if (e.detail.changed.some(a => a == "soundplaying" || a == "activemedia-blocked" || a == "muted")) this.refresh();
    });
    gBrowser.tabContainer.addEventListener("TabSelect", () => this.refresh());
    gBrowser.tabContainer.addEventListener("TabClose", e => e.target == this.tab && setTimeout(() => this.refresh()));
  },

  // A thin bar the pointer can drag; onPick gets a fraction 0..1.
  bar(onPick) {
    const h = Orbit.h.bind(Orbit);
    const fill = h("i", {});
    const el = h("div", { class: "orbit-media-bar", tabindex: 0, role: "slider" }, fill);
    const pick = e => {
      const r = el.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      fill.style.width = `${f * 100}%`;
      return f;
    };
    el.addEventListener("pointerdown", e => {
      if (e.button != 0) return;
      el.setPointerCapture(e.pointerId);
      el.setAttribute("dragging", "true");
      pick(e);
    });
    el.addEventListener("pointermove", e => el.hasPointerCapture(e.pointerId) && pick(e));
    el.addEventListener("pointerup", e => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      el.releasePointerCapture(e.pointerId);
      el.removeAttribute("dragging");
      onPick(pick(e));
    });
    el.addEventListener("keydown", e => {
      const d = { ArrowLeft: -0.05, ArrowRight: 0.05 }[e.key];
      if (!d) return;
      e.preventDefault();
      onPick(Math.min(1, Math.max(0, (parseFloat(fill.style.width) || 0) / 100 + d)));
    });
    return { el, set: f => !el.hasAttribute("dragging") && (fill.style.width = `${Math.min(1, Math.max(0, f)) * 100}%`) };
  },

  fmt(s) {
    s = Math.max(0, Math.floor(s));
    const hms = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60];
    return (hms[0] ? `${hms[0]}:${String(hms[1]).padStart(2, "0")}` : `${hms[1]}`) + `:${String(hms[2]).padStart(2, "0")}`;
  },

  // Position = last reported one + time elapsed at the playback rate.
  tick() {
    const p = this.pos;
    const ok = p?.duration > 0 && isFinite(p.duration);
    this.seekRow.hidden = !ok;
    if (ok) {
      const playing = this.ctl()?.isPlaying;
      const now = Math.min(p.duration, p.position + (playing ? ((performance.now() - p.at) / 1000) * p.playbackRate : 0));
      this.seek.set(now / p.duration);
      this.timeNow.textContent = this.fmt(now);
      this.timeEnd.textContent = this.fmt(p.duration);
    }
    if (this.hover && !this.timer) this.timer = setInterval(() => this.tick(), 500);
  },

  // Volume lives in the page's media elements (OrbitMedia actor, every frame).
  actors() {
    const bc = this.tab?.linkedBrowser?.browsingContext;
    return (bc?.getAllBrowsingContextsInSubtree() ?? [])
      .map(c => { try { return c.currentWindowGlobal?.getActor("OrbitMedia"); } catch { return null; } })
      .filter(Boolean);
  },

  async readVolume() {
    const values = await Promise.all(this.actors().map(a => a.sendQuery("OrbitMedia:GetVolume").catch(() => null)));
    const v = values.find(x => typeof x == "number");
    this.volume.set(this.tab?.muted ? 0 : v ?? 1);
  },

  setVolume(f) {
    if (this.tab?.muted && f > 0) this.tab.toggleMuteAudio();
    for (const a of this.actors()) a.sendAsyncMessage("OrbitMedia:SetVolume", { v: f });
  },

  ctl(tab = this.tab) {
    return tab?.linkedBrowser?.browsingContext?.mediaController ?? null;
  },

  refresh() {
    // Prefer the tab that is audibly playing; keep the last one while paused.
    const playing = gBrowser.tabs.find(t => t.soundPlaying);
    const next = playing ?? (this.tab && !this.tab.closing && this.ctl()?.isActive ? this.tab : null);
    if (next != this.tab) this.watch(next);
    this.render();
  },

  watch(tab) {
    const old = this.ctl();
    if (old && this._listener) {
      for (const t of ["metadatachange", "playbackstatechange", "deactivated"]) old.removeEventListener(t, this._listener);
      old.removeEventListener("positionstatechange", this._onPos);
    }
    this.tab = tab;
    this.pos = null;
    const c = this.ctl();
    if (c) {
      this._listener ??= () => this.render();
      this._onPos ??= e => {
        this.pos = { duration: e.duration, position: e.position, playbackRate: e.playbackRate || 1, at: performance.now() };
        this.tick();
      };
      for (const t of ["metadatachange", "playbackstatechange", "deactivated"]) c.addEventListener(t, this._listener);
      c.addEventListener("positionstatechange", this._onPos);
    }
  },

  toggle() {
    const c = this.ctl();
    if (!c) return;
    if (c.isPlaying) c.pause("user");
    else c.play();
    setTimeout(() => this.render(), 80);
  },

  render() {
    const c = this.ctl();
    // Short clips never activate the media controller; sound alone is enough.
    const visible = !!((c?.isActive || this.tab?.soundPlaying) && !this.tab.selected);
    this.card.hidden = !visible;
    if (!visible) return;
    let meta = null;
    try {
      meta = c.getMetadata();
    } catch {}
    this.title.textContent = meta?.title || this.tab.label;
    let host = "";
    try {
      host = this.tab.linkedBrowser.currentURI.host.replace(/^www\./, "");
    } catch {}
    this.sub.textContent = meta?.artist || host;
    const art = meta?.artwork?.at(-1)?.src;
    this.art.src = art && /^https:/.test(art) ? art : this.tab.getAttribute("image") || `${Orbit.BASE}icons/music.svg`;
    this.art.toggleAttribute("icon", !(art && /^https:/.test(art)));
    const playing = c?.isPlaying || this.tab.soundPlaying;
    this.playBtn.replaceChildren(Orbit.icon(playing ? "pause" : "play"));
    this.playBtn.setAttribute("aria-label", playing ? "Pause" : Orbit.tr("Play", "Lecture"));
    this.muteBtn.replaceChildren(Orbit.icon(this.tab.muted ? "volume-x" : "volume-2"));
    if (this.tab.muted) this.volume.set(0);
    this.tick();
  },
};
