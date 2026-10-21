/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var OrbitAI = {
  get ENGINES() {
    return ChromeUtils.importESModule("resource://orbit/orbit-pure.mjs").ASSISTANTS;
  },

  async init() {
    if (Orbit.pref("orbit.ai.engines-version", 0) >= 1) return;
    try {
      await Orbit.search.init();
      for (const e of this.ENGINES) {
        if (!Orbit.search.getEngineByName(e.name)) {
          await Orbit.search.addUserEngine({ name: e.name, url: e.url, alias: e.alias });
        }
      }
      Services.prefs.setIntPref("orbit.ai.engines-version", 1);
    } catch (err) {
      console.error("Orbit: could not add AI engines", err);
    }
  },

  url(name, q) {
    const e = this.ENGINES.find(x => x.name == name) ?? this.ENGINES[0];
    return e.url.replace("{searchTerms}", encodeURIComponent(q));
  },

  toggleAssistant() {
    if (!Orbit.pref("browser.ml.chat.enabled", true)) Services.prefs.setBoolPref("browser.ml.chat.enabled", true);
    SidebarController.toggle("viewGenaiChatSidebar");
  },

  async askTabs(tabs, mode, question = "") {
    if (mode == "ask" && !question) {
      return OrbitPalette.ask(Orbit.tr("Your question about these tabs", "Ta question sur ces onglets"), q => q && this.askTabs(tabs, mode, q));
    }
    const PER_TAB = tabs.length > 1 ? 12000 : 30000;
    const parts = await Promise.all(tabs.map(async tab => {
      let text = "";
      try {
        const actor = tab.linkedBrowser.browsingContext?.currentWindowGlobal?.getActor("PageExtractor");
        text = (await actor?.getText())?.text ?? "";
      } catch {}
      return `## ${tab.label}\n${tab.linkedBrowser.currentURI.spec}\n\n${text.slice(0, PER_TAB)}`;
    }));
    const ask = {
      summary: Orbit.tr("Summarize this page clearly, with the key points first.", "Résume cette page clairement, avec les points clés d'abord."),
      compare: Orbit.tr("Compare these pages: what they have in common, how they differ, and which one fits best for what.",
        "Compare ces pages : leurs points communs, leurs différences, et laquelle convient le mieux pour quoi."),
      ask: question,
    }[mode];
    const prompt = `${ask}\n\n${parts.join("\n\n---\n\n")}`;
    const e = this.ENGINES.find(x => x.home == Orbit.pref("browser.ml.chat.provider", "")) ?? this.ENGINES[0];
    if (encodeURIComponent(prompt).length < 6000) {
      openTrustedLinkIn(this.url(e.name, prompt), "tab");
      return;
    }
    Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(prompt);
    openTrustedLinkIn(e.home, "tab");
    OrbitNotify.show({ kind: "ai", icon: "bot", tone: "ok", title: e.name, timeout: 8000,
      text: Orbit.tr("The pages were copied: paste them in the box with Ctrl+V.", "Les pages sont copiées : colle-les dans la zone avec Ctrl+V.") });
  },
};
