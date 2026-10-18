/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// AI: each assistant becomes a search engine with an @alias (type
// "@claude question" in the address bar), and the assistant panel is
// Firefox's chatbot sidebar (a plain web view, loaded only when opened).
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

  // Search URL for a query with a given assistant (used by the home page).
  url(name, q) {
    const e = this.ENGINES.find(x => x.name == name) ?? this.ENGINES[0];
    return e.url.replace("{searchTerms}", encodeURIComponent(q));
  },

  toggleAssistant() {
    if (!Orbit.pref("browser.ml.chat.enabled", true)) Services.prefs.setBoolPref("browser.ml.chat.enabled", true);
    SidebarController.toggle("viewGenaiChatSidebar");
  },
};
