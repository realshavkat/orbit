// Usage: node tools/mn.mjs eval - < tools/snap.js  (prefix with setup code via cat)
const bmp = await window.browsingContext.currentWindowGlobal.drawSnapshot(null, 1, "black");
const c = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
c.width = bmp.width; c.height = bmp.height;
c.getContext("2d").drawImage(bmp, 0, 0);
return c.toDataURL("image/png");
