/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Runs in orbit-ref.html. The content lives in a remote <browser>, like
// Firefox's own Picture-in-Picture: the web never runs in this chrome window.

window.addEventListener("DOMContentLoaded", () => {
  const args = window.arguments?.[0]?.wrappedJSObject ?? window.arguments?.[0] ?? {};
  const fr = Services.locale.appLocaleAsBCP47.startsWith("fr");
  const $ = id => document.getElementById(id);
  $("tab").title = fr ? "Ouvrir dans un onglet" : "Open in a tab";
  $("close").title = fr ? "Fermer" : "Close";

  const browser = document.createXULElement("browser");
  for (const [k, v] of Object.entries({ type: "content", remote: "true", maychangeremoteness: "true",
    messagemanagergroup: "orbit-ref", disableglobalhistory: "true", tabindex: "-1" })) browser.setAttribute(k, v);
  $("holder").append(browser);

  const load = url => {
    let uri;
    try {
      uri = Services.io.newURI(url);
    } catch {
      return;
    }
    // Only web pages, web media and local files; never chrome: or about: pages.
    if (!["http", "https", "file"].includes(uri.scheme)) return;
    browser.fixupAndLoadURIString(uri.spec, { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
    $("title").textContent = args.title || uri.displaySpec;
  };
  if (args.icon) $("favicon").src = args.icon;
  else $("favicon").hidden = true;
  load(args.url);

  browser.addEventListener("pagetitlechanged", () => browser.contentTitle && ($("title").textContent = browser.contentTitle));
  $("close").addEventListener("click", () => window.close());
  $("tab").addEventListener("click", () => {
    const win = Services.wm.getMostRecentWindow("navigator:browser");
    const url = browser.currentURI?.spec;
    if (win && url) {
      win.gBrowser.selectedTab = win.gBrowser.addTrustedTab(url);
      win.focus();
      window.close();
    }
  });
  window.addEventListener("keydown", e => {
    if (e.key == "Escape" || ((e.ctrlKey || e.metaKey) && e.key == "w")) window.close();
  });

  // Drop a file, an image or a link on the window to show it instead.
  const body = document.body;
  window.addEventListener("dragover", e => {
    e.preventDefault();
    body.setAttribute("dragging", "true");
  });
  window.addEventListener("dragleave", e => e.relatedTarget == null && body.removeAttribute("dragging"));
  window.addEventListener("drop", e => {
    e.preventDefault();
    body.removeAttribute("dragging");
    const dt = e.dataTransfer;
    const file = dt.files?.[0];
    const url = file ? Services.io.newFileURI(file.mozFullPath ? new FileUtils.File(file.mozFullPath) : file).spec
      : dt.getData("text/uri-list").split("\n").find(l => l && !l.startsWith("#")) || dt.getData("text/plain");
    if (url) {
      args.title = "";
      $("favicon").hidden = true;
      load(url.trim());
    }
  });
}, { once: true });

const { FileUtils } = ChromeUtils.importESModule("resource://gre/modules/FileUtils.sys.mjs");
