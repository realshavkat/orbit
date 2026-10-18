// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Generates configs/branding/release/* (what surfer turns into
// browser/branding/release) from the Orbit artwork in assets/.
//   npm run branding
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "configs/branding/release");
mkdirSync(join(out, "content"), { recursive: true });

const appIcon = readFileSync(join(root, "assets/logoapp.png"));
const planetPaths = [...readFileSync(join(root, "assets/logonobgsvg.svg"), "utf8").matchAll(/ d="([^"]+)"/g)].map(m => m[1]);

// The planet mark (331x251) centered in a rounded square.
function iconSvg({ size = 1024, bg = "#000", bg2 = null, fg = "#fefefe", radius = 0.23, pad = 0.2 }) {
  const inner = size * (1 - pad * 2);
  const scale = inner / 331;
  const ty = (size - 251 * scale) / 2;
  const fill = bg2 ? "url(#g)" : bg;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
  ${bg == "none" ? "" : `<rect width="${size}" height="${size}" rx="${size * radius}" fill="${fill}"/>`}
  <g transform="translate(${size * pad} ${ty}) scale(${scale})">${planetPaths.map(d => `<path d="${d}" fill="${fg}"/>`).join("")}</g>
</svg>`;
}

const square = img => sharp(img).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const appPng = await square(appIcon);
const privatePng = await sharp(Buffer.from(iconSvg({ bg: "#5b21b6", bg2: "#c026d3" }))).png().toBuffer();
const png = (src, size) => sharp(src).resize(size, size).png().toBuffer();

// Banner: dark gradient with the icon centered (installer art, about box).
async function banner(w, h, iconRatio = 0.42) {
  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>
    <radialGradient id="a" cx="0" cy="0" r="1.2"><stop offset="0" stop-color="#5b3df5"/><stop offset="1" stop-color="#0b0b10" stop-opacity="0"/></radialGradient>
    <radialGradient id="b" cx="1" cy="1" r="1.2"><stop offset="0" stop-color="#c43fa8"/><stop offset="1" stop-color="#0b0b10" stop-opacity="0"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="#0b0b10"/><rect width="100%" height="100%" fill="url(#a)" opacity=".7"/><rect width="100%" height="100%" fill="url(#b)" opacity=".6"/></svg>`;
  const s = Math.round(Math.min(w, h) * iconRatio);
  return sharp(Buffer.from(bg))
    .composite([{ input: await png(appPng, s), left: Math.round((w - s) / 2), top: Math.round((h - s) / 2) }])
    .removeAlpha();
}

// ICO with PNG-compressed entries (Vista+).
async function ico(src, sizes) {
  const imgs = await Promise.all(sizes.map(s => png(src, s)));
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((s, i) => {
    const e = 6 + 16 * i;
    header[e] = s >= 256 ? 0 : s;
    header[e + 1] = s >= 256 ? 0 : s;
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(imgs[i].length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += imgs[i].length;
  });
  return Buffer.concat([header, ...imgs]);
}

// 24-bit bottom-up BMP, as NSIS expects.
async function bmp(pipeline) {
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const row = Math.ceil((w * 3) / 4) * 4;
  const buf = Buffer.alloc(54 + row * h);
  buf.write("BM", 0);
  buf.writeUInt32LE(buf.length, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(row * h, 34);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * c;
      const di = 54 + (h - 1 - y) * row + x * 3;
      buf[di] = data[si + 2];
      buf[di + 1] = data[si + 1];
      buf[di + 2] = data[si];
    }
  }
  return buf;
}

const files = {};
for (const s of [16, 22, 24, 32, 48, 64, 128, 256, 512]) files[`logo${s}.png`] = await png(appPng, s);
files["logo.png"] = await png(appPng, 512);
files["logo1024.png"] = await png(appPng, 1024);
files["logo-mac.png"] = await png(appPng, 1024);
files["firefox.ico"] = await ico(appPng, [16, 24, 32, 48, 64, 128, 256]);
files["firefox64.ico"] = await ico(appPng, [16, 32, 48, 64]);
files["document.ico"] = await ico(appPng, [16, 32, 48, 256]);
files["document_pdf.ico"] = await ico(appPng, [256]);
files["newtab.ico"] = await ico(appPng, [16, 32]);
files["newwindow.ico"] = await ico(appPng, [16, 32]);
files["pbmode.ico"] = await ico(privatePng, [16, 32, 48, 256]);
files["VisualElements_150.png"] = await png(appPng, 300);
files["VisualElements_70.png"] = await png(appPng, 142);
files["PrivateBrowsing_150.png"] = await png(privatePng, 300);
files["PrivateBrowsing_70.png"] = await png(privatePng, 142);
files["wizWatermark.bmp"] = await bmp(await banner(164, 314, 0.5));
files["wizHeader.bmp"] = await bmp(await banner(150, 57, 0.7));
files["wizHeaderRTL.bmp"] = files["wizHeader.bmp"];
files["content/about-logo.png"] = await png(appPng, 192);
files["content/about-logo@2x.png"] = await png(appPng, 384);
files["content/about-logo-private.png"] = await png(privatePng, 192);
files["content/about-logo-private@2x.png"] = await png(privatePng, 384);
files["content/about.png"] = await (await banner(300, 236, 0.4)).png().toBuffer();
files["content/about-logo.svg"] = iconSvg({ size: 512 });
const wordmark = fill => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 372 99" fill="${fill}"><text x="0" y="82" font-family="Segoe UI Variable Display, Segoe UI, system-ui, sans-serif" font-weight="700" font-size="96" letter-spacing="-2">Orbit</text></svg>`;
files["content/about-wordmark.svg"] = wordmark("context-fill");
files["content/firefox-wordmark.svg"] = wordmark("context-fill light-dark(#18181f, #fbfbfe)");
files["content/aboutDialog.css"] = `/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#aboutDialogContainer {
  background: radial-gradient(120% 100% at 0% 0%, #3b2a8a, transparent 70%),
    radial-gradient(120% 100% at 100% 100%, #7a2a6e, transparent 70%), #0b0b10;
  color: #fff;
  color-scheme: dark;
}

#bottomBox {
  background-color: rgb(0 0 0 / .3);
  padding: 15px 10px;
}

#rightBox {
  background-size: auto 44px;
  margin-inline: 30px;
  padding-top: 64px;
}
`;

for (const [name, data] of Object.entries(files)) writeFileSync(join(out, name), data);
console.log(`Wrote ${Object.keys(files).length} branding files to ${out}`);
