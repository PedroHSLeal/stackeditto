import { chromium } from "playwright";
import { median } from "./lib.mjs";
const N = 37800, text = "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ".repeat(2).slice(0, 220);
const browser = await chromium.launch();
for (const group of [0, 200, 20]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const ps = Array.from({ length: N }, (_, i) => `<p>${i} ${text}</p>`);
  let body = ps.join("");
  if (group) { body = ""; for (let i = 0; i < N; i += group) body += `<div>${ps.slice(i, i + group).join("")}</div>`; }
  await page.setContent(`<style>html,body{margin:0}#s{position:fixed;inset:0;overflow:auto}#e{padding:6px 12px;white-space:pre-wrap;outline:none}</style><div id=s><div id=e contenteditable>${body}</div></div>`);
  await page.evaluate(() => { const e = document.getElementById("e"); const ps = e.getElementsByTagName("p"); const p = ps[ps.length >> 1]; p.scrollIntoView(); const r = document.createRange(); r.setStart(p.firstChild, 10); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); e.focus(); });
  const lat = [];
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => { window.__l = new Promise((r2) => addEventListener("keydown", (ev) => { const t = ev.timeStamp; requestAnimationFrame(() => { const c = new MessageChannel(); c.port1.onmessage = () => r2(performance.now() - t); c.port2.postMessage(0); }); }, { once: true, capture: true })); });
    await page.keyboard.press("x");
    lat.push(Math.round(await page.evaluate(() => window.__l)));
  }
  console.log("group", group || "flat", "median", median(lat));
  await page.close();
}
await browser.close();
