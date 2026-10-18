/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Glance: Alt+click a link to preview it in a floating card over the page.
var OrbitGlance = {
  init() {
    try {
      ChromeUtils.registerWindowActor("OrbitGlance", {
        parent: { esModuleURI: "resource://orbit/actors/OrbitGlanceParent.sys.mjs" },
        child: {
          esModuleURI: "resource://orbit/actors/OrbitGlanceChild.sys.mjs",
          events: { click: { capture: true } },
        },
        allFrames: true,
        messageManagerGroups: ["browsers"],
        // The child only reports a link URL; the parent validates it.
        safeForUntrustedWebProcess: true,
      });
    } catch (e) {
      // Already registered by an earlier window.
    }
    window.addEventListener("keydown", e => {
      if (e.key == "Escape" && this.overlay) {
        e.preventDefault();
        this.close();
      }
    }, true);
  },

  open(url, triggeringPrincipal, screenPoint = null) {
    if (!Orbit.pref("orbit.glance.enabled", true)) {
      openTrustedLinkIn(url, "tab");
      return;
    }
    this.close(true);
    const { h, icon, t } = { h: Orbit.h.bind(Orbit), icon: Orbit.icon.bind(Orbit), t: Orbit.t.bind(Orbit) };

    const browser = document.createXULElement("browser");
    for (const [k, v] of Object.entries({
      type: "content", remote: "true", maychangeremoteness: "true", flex: "1",
      messagemanagergroup: "browsers", autocompletepopup: "PopupAutoComplete",
      class: "orbit-glance-browser", nodefaultsrc: "true",
    })) {
      browser.setAttribute(k, v);
    }

    const title = h("span", { class: "orbit-glance-url" }, this.pretty(url));
    const card = h("div", { class: "orbit-glance-card" },
      h("div", { class: "orbit-glance-bar" },
        title,
        h("button", { class: "orbit-icon-button", title: t("glance.copy"), onclick: () => this.copy() }, icon("link")),
        h("button", { class: "orbit-icon-button", title: t("glance.expand"), onclick: () => this.expand() }, icon("maximize-2")),
        h("button", { class: "orbit-icon-button", title: t("glance.close"), onclick: () => this.close() }, icon("x"))
      ),
      browser
    );
    const overlay = h("div", { id: "orbit-glance", onmousedown: e => e.target == overlay && this.close() }, card);
    document.getElementById("tabbrowser-tabbox").append(overlay);
    if (screenPoint) {
      // Zoom the card out of the clicked link.
      // Card is centered at 86% x 90% of the overlay (see orbit.css); its own
      // rect is already scaled by the entry animation.
      const o = overlay.getBoundingClientRect();
      const x = screenPoint.x - window.mozInnerScreenX - (o.left + o.width * 0.07);
      const y = screenPoint.y - window.mozInnerScreenY - (o.top + o.height * 0.05);
      card.style.setProperty("--orbit-glance-origin", `${Math.round(x)}px ${Math.round(y)}px`);
    }
    this.overlay = overlay;
    this.browser = browser;
    this.title = title;

    browser.loadURI(Services.io.newURI(url), {
      triggeringPrincipal: triggeringPrincipal ?? Services.scriptSecurityManager.createNullPrincipal({}),
    });
    browser.addProgressListener({
      QueryInterface: ChromeUtils.generateQI(["nsIWebProgressListener", "nsISupportsWeakReference"]),
      onLocationChange: (_wp, _req, location) => (title.textContent = this.pretty(location.spec)),
    }, Ci.nsIWebProgress.NOTIFY_LOCATION);
  },

  pretty(url) {
    try {
      const u = new URL(url);
      return u.host.replace(/^www\./, "") + (u.pathname == "/" ? "" : u.pathname);
    } catch {
      return url;
    }
  },

  currentURL() {
    return this.browser?.currentURI?.spec || "";
  },

  copy() {
    Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(this.currentURL());
  },

  expand() {
    const url = this.currentURL();
    this.close(true);
    if (url && url != "about:blank") {
      gBrowser.selectedTab = gBrowser.addTrustedTab(url, { relatedToCurrent: true });
    }
  },

  close(instant = false) {
    const overlay = this.overlay;
    if (!overlay) return;
    this.overlay = this.browser = null;
    if (instant || window.gReduceMotion) {
      overlay.remove();
      return;
    }
    overlay.setAttribute("closing", "true");
    setTimeout(() => overlay.remove(), 200);
  },
};
