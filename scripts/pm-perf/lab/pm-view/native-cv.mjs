// Native-only experiments: wrappers with content-visibility, initial layout cost and per-key cost (37.8k paragraphs).
import { chromium } from "playwright";
import { median, metrics } from "./lib.mjs";
const N = 37800, text = "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ".repeat(2).slice(0, 220);
const V = {
  flat: { group: 0, css: "" },
  "flat+cv-p": { group: 0, css: "#e>p{content-visibility:auto;contain-intrinsic-size:auto 60px}" },
  "sections100": { group: 100, css: "" },
  "sections100+cv": { group: 100, css: "#e>div{content-visibility:auto;contain-intrinsic-size:auto 6000px}" },
  "sections1000+cv": { group: 1000, css: "#e>div{content-visibility:auto;contain-intrinsic-size:auto 60000px}" },
};
const browser = await chromium.launch();
for (const [name, v] of Object.entries(V)) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const ps = Array.from({ length: N }, (_, i) => `<p>${i} ${text}</p>`);
  let body = ps.join(""); if (v.group) { body = ""; for (let i = 0; i < N; i += v.group) body += `<div>${ps.slice(i, i + v.group).join("")}</div>`; }
  await page.setContent(`<style>html,body{margin:0}#s{position:fixed;inset:0;overflow:auto}#e{padding:6px 12px;white-space:pre-wrap;outline:none}${v.css}</style><div id=s><div id=e contenteditable></div></div>`);
  const client = await page.context().newCDPSession(page); await client.send("Performance.enable");
  const init = await page.evaluate(async (body) => { const e = document.getElementById("e"); const t = performance.now(); e.innerHTML = body; void e.offsetHeight; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return performance.now() - t; }, body);
  await page.evaluate(() => { const e = document.getElementById("e"); const ps = e.getElementsByTagName("p"); const p = ps[ps.length >> 1]; p.scrollIntoView(); const r = document.createRange(); r.setStart(p.firstChild, 10); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); e.focus(); });
  const lat = []; const m0 = await metrics(client);
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => { window.__l = new Promise((r2) => addEventListener("keydown", (ev) => { const t = ev.timeStamp; requestAnimationFrame(() => { const c = new MessageChannel(); c.port1.onmessage = () => r2(performance.now() - t); c.port2.postMessage(0); }); }, { once: true, capture: true })); });
    await page.keyboard.press("x"); lat.push(Math.round(await page.evaluate(() => window.__l)));
  }
  const m1 = await metrics(client);
  console.log(name.padEnd(18), "initial layout+2frames", Math.round(init), "ms | key median", median(lat), "task/key", Math.round((m1.TaskDuration - m0.TaskDuration) * 1000 / 12));
  await page.close();
}
await browser.close();
