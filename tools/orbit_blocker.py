# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
"""Build Orbit Blocker from a uBlock Origin release.

Orbit Blocker is uBlock Origin (GPL-3.0, Raymond Hill) with Orbit's name,
icons and popup, and Brave Shields' default filter lists turned on: uBO's own
lists, EasyList, EasyPrivacy, URLhaus, Peter Lowe, the cookie notice lists,
Fanboy's mobile notifications, AdGuard Ads and Brave's own lists (unbreak,
specific, social, first party, cookies, sugarcoat). Brave runs these same
lists, in the same syntax and with uBO's scriptlets, through adblock-rust.
Orbit adds its Stealth list: blocked requests get an empty, valid answer
instead of a network error, so scripts testing whether ads loaded see them load.
Like Brave's standard mode, generic cosmetic filters are off by default: bait
elements an anti-adblock script plants stay visible, while network blocking and
site-specific cosmetic filters still remove the ads. The add-on stays
GPL-3.0: its license and full source ship inside the .xpi.

Usage: python tools/orbit_blocker.py <uBlock0.firefox.xpi> <out-dir>
"""
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADDON_ID = "orbit-blocker@orbit.app"
NAME = "Orbit Blocker"
ENABLE = {"adguard-generic", "fanboy-cookiemonster", "ublock-cookies-easylist", "adguard-spyware-url", "block-lan"}
BRAVE = "https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/"
BRAVE_LISTS = {
    "brave-unbreak": ("Brave – Unbreak", "default", "brave-unbreak.txt"),
    "brave-specific": ("Brave – Specific", "ads", "brave-specific.txt"),
    "brave-firstparty": ("Brave – First party ads", "ads", "brave-firstparty.txt"),
    "brave-sugarcoat": ("Brave – SugarCoat", "privacy", "brave-sugarcoat.txt"),
    "brave-social": ("Brave – Social", "privacy", "brave-social.txt"),
    "brave-cookie-specific": ("Brave – Cookie notices", "annoyances", "brave-cookie-specific.txt"),
}
EXTRA_LISTS = {
    "orbit-stealth": {
        "content": "filters", "group": "default", "title": "Orbit – Stealth", "tags": "ads",
        "contentURL": ["assets/orbit/orbit-stealth.txt"],
        "supportURL": "https://github.com/realshavkat/orbit",
    },
    "fanboy-mobile-notifications": {
        "content": "filters", "group": "annoyances", "title": "Fanboy – Mobile app promos", "tags": "annoyances",
        "contentURL": "https://secure.fanboy.co.nz/fanboy-mobile-notifications.txt",
        "supportURL": "https://github.com/easylist/easylist#fanboy-lists",
    },
}
ICONS = ROOT / "assets" / "blocker"
POPUP = ICONS / "popup"
EXTRA_FILES = {
    "css/orbit-popup.css": POPUP / "orbit-popup.css",
    "js/orbit-popup.js": POPUP / "orbit-popup.js",
    "fonts/Outfit.ttf": ROOT / "src/browser/base/content/orbit/fonts/Outfit.ttf",
    "assets/orbit/orbit-stealth.txt": ICONS / "filters" / "orbit-stealth.txt",
}

NOTICE = f"""{NAME} is a modified version of uBlock Origin by Raymond Hill
(https://github.com/gorhill/uBlock), licensed under GPL-3.0 (LICENSE.txt).
Changes for Orbit: name, icons, add-on id, an Orbit-styled popup with a simple
and an advanced mode (css/orbit-popup.css, js/orbit-popup.js), and the default
filter lists of Brave Shields, including Brave's own lists from
https://github.com/brave/adblock-lists (MPL-2.0). The complete source is this package.
"""


def assets(data):
    a = json.loads(data)
    a["assets.json"]["contentURL"] = ["assets/assets.json"]
    a["assets.json"].pop("cdnURLs", None)
    for key in ENABLE:
        a[key].pop("off", None)
    for key, (title, group, file) in BRAVE_LISTS.items():
        a[key] = {"content": "filters", "group": group, "title": title, "tags": group,
                  "contentURL": BRAVE + file, "supportURL": "https://github.com/brave/adblock-lists"}
    a.update(EXTRA_LISTS)
    return json.dumps(a, indent=1, ensure_ascii=False).encode()


def patch(name, data):
    if name.startswith("META-INF/"):
        return None
    if name == "manifest.json":
        m = json.loads(data)
        m["name"] = NAME
        m["version"] = "2026.1100." + "".join(m["version"].split("."))
        m["author"] = "Raymond Hill (uBlock Origin), Orbit"
        m["browser_action"]["default_title"] = NAME
        m["browser_specific_settings"]["gecko"]["id"] = ADDON_ID
        m["browser_specific_settings"]["gecko"].pop("update_url", None)
        m["icons"] = {size: f"img/icon_{size}.png" for size in ("16", "32", "64")}
        return json.dumps(m, indent=2, ensure_ascii=False).encode()
    if re.fullmatch(r"_locales/[^/]+/messages\.json", name):
        msgs = json.loads(data)
        for msg in msgs.values():
            m = msg.get("message", "")
            msg["message"] = m.replace("uBlock Origin", NAME).replace("uBlock₀", NAME).replace("uBO", NAME)
        if "extName" in msgs:
            msgs["extName"]["message"] = NAME
        return json.dumps(msgs, indent=1, ensure_ascii=False).encode()
    if name == "assets/assets.json":
        return assets(data)
    if name == "js/background.js":
        assert data.count(b"ignoreGenericCosmeticFilters: false,") == 1
        return data.replace(b"ignoreGenericCosmeticFilters: false,", b"ignoreGenericCosmeticFilters: true,")
    m = re.fullmatch(r"img/icon_(\d+)(-off|-loading)?\.png", name)
    if m:
        return (ICONS / f"{'off' if m.group(2) == '-off' else 'on'}-{m.group(1)}.png").read_bytes()
    if name == "img/ublock.svg":
        return (ICONS / "shield-on.svg").read_bytes()
    if name == "popup-fenix.html":
        data = data.replace(b"</head>", b'<link rel="stylesheet" href="css/orbit-popup.css">\n</head>')
        data = data.replace(b"</body>", b'<script src="js/orbit-popup.js" type="module"></script>\n</body>')
    return data


def main(src, out_dir):
    out = Path(out_dir) / f"{ADDON_ID}.xpi"
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            if info.is_dir():
                continue
            data = patch(info.filename, zin.read(info.filename))
            if data is not None:
                zout.writestr(info.filename, data)
        for arc, path in EXTRA_FILES.items():
            zout.writestr(arc, path.read_bytes())
        zout.writestr("NOTICE-ORBIT.txt", NOTICE)
    with zipfile.ZipFile(out) as z:
        m = json.loads(z.read("manifest.json"))
        assert m["browser_specific_settings"]["gecko"]["id"] == ADDON_ID and m["name"] == NAME
        a = json.loads(z.read("assets/assets.json"))
        on = {k for k, v in a.items() if v.get("content") == "filters" and not v.get("off")}
        assert ENABLE | set(BRAVE_LISTS) | set(EXTRA_LISTS) | {"easylist", "easyprivacy", "ublock-filters", "urlhaus-1"} <= on, on
        assert a["assets.json"]["contentURL"] == ["assets/assets.json"]
        assert not any(n.startswith("META-INF/") for n in z.namelist())
        assert b"orbit-popup.js" in z.read("popup-fenix.html")
    print(out)


if __name__ == "__main__":
    main(*sys.argv[1:3])
