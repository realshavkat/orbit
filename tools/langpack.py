# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

"""Builds Orbit-branded language packs from Mozilla's official ones.

Downloads <locale>.xpi for the Firefox version in surfer.json, checks it
against Mozilla's SHA256SUMS, swaps the Firefox brand strings for Orbit and
writes src/browser/base/langpacks/langpack-<locale>@firefox.mozilla.org.xpi.
They ship unsigned in the app scope (--with-unsigned-addon-scopes=app).

    python tools/langpack.py fr
"""

import hashlib
import io
import json
import pathlib
import sys
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
FX = json.loads((ROOT / "surfer.json").read_text())["version"]["version"]
BASE = f"https://archive.mozilla.org/pub/firefox/releases/{FX}"
OUT = ROOT / "src/browser/base/langpacks"

BRAND_FTL = """-brand-shorter-name = Orbit
-brand-short-name = Orbit
-brand-shortcut-name = Orbit
-brand-full-name = Orbit
-brand-product-name = Orbit
-vendor-short-name = Orbit
trademarkInfo = { " " }
"""
BRAND_PROPS = "brandShorterName=Orbit\nbrandShortName=Orbit\nbrandFullName=Orbit\n"


def fetch(url):
    with urllib.request.urlopen(url) as r:
        return r.read()


def main(locales):
    sums = fetch(f"{BASE}/SHA256SUMS").decode()
    OUT.mkdir(parents=True, exist_ok=True)
    for loc in locales:
        name = f"win64/xpi/{loc}.xpi"
        data = fetch(f"{BASE}/{name}")
        expected = next(l.split()[0] for l in sums.splitlines() if l.endswith(" " + name))
        assert hashlib.sha256(data).hexdigest() == expected, f"checksum mismatch for {name}"

        src = zipfile.ZipFile(io.BytesIO(data))
        out = OUT / f"langpack-{loc}@firefox.mozilla.org.xpi"
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as dst:
            for item in src.infolist():
                n = item.filename
                if n.startswith("META-INF/"):
                    continue  # Mozilla's signature no longer matches
                if n.endswith("branding/brand.ftl"):
                    dst.writestr(n, BRAND_FTL)
                elif n.endswith("branding/brand.properties"):
                    dst.writestr(n, BRAND_PROPS)
                else:
                    dst.writestr(item, src.read(n))
        print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1:] or ["fr"])
