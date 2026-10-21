/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  Downloads: "resource://gre/modules/Downloads.sys.mjs",
  DownloadsCommon: "resource:///modules/DownloadsCommon.sys.mjs",
  FileUtils: "resource://gre/modules/FileUtils.sys.mjs",
});

const PAGE = "resource://orbit/downloads.html";
const ids = new WeakMap();
const byId = new Map();
let nextId = 1;

function idOf(d) {
  let id = ids.get(d);
  if (!id) {
    id = nextId++;
    ids.set(d, id);
    byId.set(id, new WeakRef(d));
  }
  return id;
}

function stateOf(d) {
  if (d.succeeded) return "done";
  if (d.error) return "failed";
  if (!d.stopped) return "running";
  return d.hasPartialData ? "paused" : "canceled";
}

function info(d) {
  let referrer = "";
  try {
    referrer = d.source.referrerInfo?.originalReferrer?.spec ?? "";
  } catch {}
  return {
    id: idOf(d),
    name: PathUtils.filename(d.target.path),
    dir: PathUtils.parent(d.target.path) ?? "",
    url: d.source.url,
    referrer,
    start: d.startTime ? new Date(d.startTime).getTime() : 0,
    size: d.target.size ?? 0,
    total: d.hasProgress ? d.totalBytes : 0,
    current: d.currentBytes,
    speed: d.speed ?? 0,
    state: stateOf(d),
    exists: !!d.target.exists,
  };
}

export class OrbitDownloadsParent extends JSWindowActorParent {
  async receiveMessage(msg) {
    if (!this.manager.documentURI?.spec.startsWith(PAGE)) return null;
    const list = await lazy.Downloads.getList(lazy.Downloads.ALL);
    const win = this.browsingContext.topChromeWindow;
    switch (msg.name) {
      case "OrbitDownloads:Get": {
        this.watch(list);
        const all = await list.getAll();
        await Promise.all(all.map(d => d.refresh().catch(() => {})));
        return {
          lang: Services.locale.appLocaleAsBCP47,
          strings: win?.OrbitDownloads?.pageStrings() ?? {},
          dir: await lazy.Downloads.getPreferredDownloadsDirectory(),
          items: all.map(info),
        };
      }
      case "OrbitDownloads:Act":
        return this.act(list, msg.data?.action, msg.data?.id, win);
    }
    return null;
  }

  async act(list, action, id, win) {
    if (action == "openDir") {
      const dir = await lazy.Downloads.getPreferredDownloadsDirectory();
      new lazy.FileUtils.File(dir).launch();
      return null;
    }
    if (action == "clear") {
      await list.removeFinished();
      return null;
    }
    const d = byId.get(Number(id))?.deref();
    if (!d) return null;
    switch (action) {
      case "open":
        await d.launch();
        break;
      case "folder":
        await d.showContainingDirectory();
        break;
      case "retry":
        d.start().catch(() => {});
        break;
      case "pause":
        d.tryToKeepPartialData = true;
        await d.cancel();
        break;
      case "cancel":
        await d.cancel();
        await d.removePartialData().catch(() => {});
        break;
      case "copy":
        Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(d.source.url);
        break;
      case "source": {
        let url = d.source.url;
        try {
          url = d.source.referrerInfo?.originalReferrer?.spec || url;
        } catch {}
        if (/^https?:/.test(url)) win?.openTrustedLinkIn(url, "tab");
        break;
      }
      case "remove":
        await list.remove(d);
        break;
      case "delete":
        await lazy.DownloadsCommon.deleteDownloadFiles(d, 1);
        break;
    }
    return null;
  }

  watch(list) {
    if (this._view) return;
    this._pending = new Map();
    const push = d => {
      this._pending.set(idOf(d), d);
      if (this._timer) return;
      this._timer = setTimeout(() => {
        this._timer = 0;
        const items = [...this._pending.values()].map(info);
        this._pending.clear();
        try {
          this.sendAsyncMessage("OrbitDownloads:Changed", { items });
        } catch {}
      }, 300);
    };
    this._list = list;
    this._view = {
      onDownloadAdded: push,
      onDownloadChanged: push,
      onDownloadRemoved: d => {
        try {
          this.sendAsyncMessage("OrbitDownloads:Removed", { id: idOf(d) });
        } catch {}
      },
    };
    list.addView(this._view);
  }

  didDestroy() {
    clearTimeout(this._timer);
    if (this._view) this._list.removeView(this._view);
  }
}
