#!/bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
# Builds what a release needs, after a successful build (run it through the
# MozillaBuild shell: tools\mozbuild.cmd sh tools/package.sh):
#   dist/Orbit-Setup-<version>.exe       installer for new users
#   dist/windows.mar                     full update, signed with Orbit's key
#   dist/update/browser/<target>/release/update.xml
# The signing key lives outside the repository: $ORBIT_MAR_KEY, default
# ~/.orbit-signing/mar-key.pem. Its certificate is built into the updater
# (toolkit/mozapps/update/updater/release_*.der).
set -e
export VSLANG=1033 PYTHONUTF8=1
cd "$(dirname "$0")/.."
ROOT=$PWD
OBJ=$ROOT/engine/obj-x86_64-pc-windows-msvc
VERSION=$(node -p "require('./surfer.json').brands.release.release.displayVersion")
KEY=${ORBIT_MAR_KEY:-$USERPROFILE/.orbit-signing/mar-key.pem}
[ -f "$KEY" ] || { echo "No MAR signing key at $KEY"; exit 1; }
mkdir -p dist

echo "== Package $VERSION"
(cd engine && ./mach package)
# On Windows, `mach package` also builds the NSIS installer.
cp "$(ls -t "$OBJ"/dist/*.win64.installer.exe | head -1)" "dist/Orbit-Setup-$VERSION.exe"

echo "== Signed MAR"
# make_full_update.sh calls $MAR like Mozilla's mar tool; this wrapper signs.
# Python's mar writes the archive in the current directory, Mozilla's in -C.
cat > "$ROOT/.dev/signmar.sh" <<EOF
#!/bin/sh
"$ROOT/.dev/marenv/Scripts/mar" -k "$KEY" "\$@" || exit \$?
dir=; out=
while [ \$# -gt 0 ]; do
  [ "\$1" = "-C" ] && dir=\$2
  [ "\$1" = "-c" ] && out=\$2
  shift
done
if [ -n "\$dir" ] && [ -f "\$out" ]; then mv -f "\$out" "\$dir/\$out"; fi
EOF
chmod +x "$ROOT/.dev/signmar.sh"
rm -f dist/windows.mar
(cd engine && MOZ_PRODUCT_VERSION=$VERSION MAR_CHANNEL_ID=release ACCEPTED_MAR_CHANNEL_IDS=release \
  MAR="$ROOT/.dev/signmar.sh" ./tools/update-packaging/make_full_update.sh "$ROOT/dist" "$OBJ/dist/orbit")
mv dist/output.mar dist/windows.mar
# Verify against the certificate built into the updater (4096-bit key: SHA-384).
openssl x509 -inform DER -in "$ROOT/src/toolkit/mozapps/update/updater/release_primary.der" -pubkey -noout > "$ROOT/.dev/mar-pub.pem"
"$ROOT/.dev/marenv/Scripts/mar" -k "$ROOT/.dev/mar-pub.pem" -v dist/windows.mar
echo "MAR signature OK"

echo "== update.xml"
# The packaged app (what the MAR installs) gives the build IDs.
node tools/update-xml.mjs "$VERSION" dist/windows.mar "$OBJ/dist/orbit/platform.ini"
echo "Done: dist/Orbit-Setup-$VERSION.exe, dist/windows.mar, dist/update/"
