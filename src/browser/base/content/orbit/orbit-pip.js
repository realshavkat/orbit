/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function () {
  const doc = document;
  if (doc.documentElement.hasAttribute("orbit-pip")) return;
  doc.documentElement.setAttribute("orbit-pip", "true");
  const link = doc.createElementNS("http://www.w3.org/1999/xhtml", "link");
  link.rel = "stylesheet";
  link.href = "chrome://orbit/content/orbit-pip.css";
  doc.head.append(link);
  const controls = doc.getElementById("controls");
  const timestamp = doc.getElementById("timestamp");
  const start = doc.querySelector(".start-controls");
  const label = Services.locale.appLocaleAsBCP47.startsWith("fr") ? "EN DIRECT" : "LIVE";
  let timer = 0;
  const update = () => {
    clearTimeout(timer);
    if (timestamp.textContent) start.removeAttribute("orbit-live");
    else if (controls.classList.contains("playing") && !start.hasAttribute("orbit-live")) {
      timer = setTimeout(() => !timestamp.textContent && start.setAttribute("orbit-live", label), 1500);
    }
  };
  new MutationObserver(update).observe(controls, { attributeFilter: ["class"] });
  new MutationObserver(update).observe(timestamp, { childList: true, characterData: true, subtree: true });
  update();
})();
