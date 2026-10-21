// This Source Code Form is subject to the terms of the Mozilla Public

import { connect } from "node:net";
import { writeFileSync, readFileSync } from "node:fs";

const [cmd, arg] = process.argv.slice(2);
const sock = connect(+(process.env.MN_PORT || 2829), "127.0.0.1");
let buf = "", id = 0;
const pending = new Map();
let hello;
const helloP = new Promise(r => (hello = r));

sock.on("data", d => {
  buf += d.toString("latin1");
  for (;;) {
    const colon = buf.indexOf(":");
    if (colon < 0) return;
    const len = +buf.slice(0, colon);
    if (buf.length < colon + 1 + len) return;
    const msg = JSON.parse(Buffer.from(buf.slice(colon + 1, colon + 1 + len), "latin1").toString("utf8"));
    buf = buf.slice(colon + 1 + len);
    if (!Array.isArray(msg)) hello(msg);
    else pending.get(msg[1])?.(msg);
  }
});

function send(name, params = {}) {
  const msgId = ++id;
  const body = Buffer.from(JSON.stringify([0, msgId, name, params]), "utf8");
  sock.write(`${body.length}:`);
  sock.write(body);
  return new Promise((res, rej) =>
    pending.set(msgId, ([, , err, result]) => (err ? rej(new Error(JSON.stringify(err))) : res(result)))
  );
}

await helloP;
await send("WebDriver:NewSession", { capabilities: {} });
await send("Marionette:SetContext", { value: process.env.MN_CONTEXT || "chrome" });
try {
  if (cmd === "eval") {
    const script = arg === "-" ? readFileSync(0, "utf8") : arg;
    const r = await send("WebDriver:ExecuteScript", { script: `return (async () => {${script}
})();`, args: [], sandbox: "system" });
    console.log(typeof r.value === "string" ? r.value : JSON.stringify(r.value, null, 1));
  } else if (cmd === "click") {
    const el = await send("WebDriver:FindElement", { using: "css selector", value: arg });
    const mod = process.argv[4] == "alt" ? "" : null;
    const origin = el.value;
    const actions = [{ type: "pointer", id: "m", parameters: { pointerType: "mouse" }, actions: [
      { type: "pause", duration: 50 }, { type: "pointerMove", x: 0, y: 0, origin }, { type: "pointerDown", button: 0 }, { type: "pointerUp", button: 0 }] }];
    if (mod) actions.unshift({ type: "key", id: "k", actions: [{ type: "keyDown", value: mod }, { type: "pause", duration: 0 }, { type: "pause", duration: 0 }, { type: "pause", duration: 0 }, { type: "pause", duration: 0 }, { type: "keyUp", value: mod }] });
    await send("WebDriver:PerformActions", { actions });
    await send("WebDriver:ReleaseActions");
  } else if (cmd === "drag") {
    const el = await send("WebDriver:FindElement", { using: "css selector", value: arg });
    const steps = process.argv[4].split(";").map(p => p.split(",").map(Number));
    const acts = [{ type: "pointerMove", x: 0, y: 0, origin: el.value }, { type: "pointerDown", button: 0 }];
    let px = 0, py = 0;
    for (const [x, y] of steps) { acts.push({ type: "pointerMove", x: x - px, y: y - py, origin: "pointer", duration: 120 }); px = x; py = y; }
    const shotPath = process.argv[5]?.endsWith(".png") ? process.argv[5] : null;
    await send("WebDriver:PerformActions", { actions: [{ type: "pointer", id: "m", parameters: { pointerType: "mouse" }, actions: acts }] });
    if (shotPath) {
      await new Promise(r => setTimeout(r, 300));
      const r = await send("WebDriver:TakeScreenshot", { full: false, hash: false });
      writeFileSync(shotPath, Buffer.from(r.value, "base64"));
      const info = await send("WebDriver:ExecuteScript", { script: "return [OrbitDnD.action?.textContent, OrbitDnD.target?.type, OrbitDnD.target?.index]", args: [], sandbox: "system" });
      console.log("during drag:", JSON.stringify(info.value));
    }
    await send("WebDriver:PerformActions", { actions: [{ type: "pointer", id: "m", parameters: { pointerType: "mouse" }, actions: [{ type: "pointerUp", button: 0 }] }] });
    await send("WebDriver:ReleaseActions");
  } else if (cmd === "actions") {
    await send("WebDriver:PerformActions", { actions: JSON.parse(arg) });
    await send("WebDriver:ReleaseActions");
  } else if (cmd === "shot") {
    const r = await send("WebDriver:TakeScreenshot", { full: false, hash: false });
    writeFileSync(arg || "shot.png", Buffer.from(r.value, "base64"));
    console.log("saved", arg);
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await send("WebDriver:DeleteSession").catch(() => {});
  sock.end();
}
