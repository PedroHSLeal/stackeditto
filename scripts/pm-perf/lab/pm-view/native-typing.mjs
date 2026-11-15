// Is the keystroke cost native? Plain contenteditable with N paragraphs, no ProseMirror at all.
import { chromium } from "playwright";
import { median, metrics } from "./lib.mjs";
const variants = {
  plain: {},
  "contain-content": { css: "#e>p{contain:content}" },
  "content-visibility": { css: "#e>p{content-visibility:auto;contain-intrinsic-size:auto 60px}" },
  "wrap-div-contain": { css: "#e{contain:layout}" },
  "no-spellcheck": { attrs: 'spellcheck="false"' },
  "pre-wrap-off": { css: "#e{white-space:normal}" },
};
const N = Number(process.argv[2] ?? 37800);
const only = process.argv[3];
const text = "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ".repeat(2).slice(0, 220);
const browser = await chromium.launch();
for (const [name, v] of Object.entries(variants)) {
  if (only && !name.match(only)) continue;
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const html = `<style>html,body{margin:0}#s{position:fixed;inset:0;overflow:auto}#e{padding:6px 12px;white-space:pre-wrap;outline:none}${v.css ?? ""}</style><div id=s><div id=e contenteditable ${v.attrs ?? ""}>${Array.from({ length: N }, (_, i) => `<p>${i} ${text}</p>`).join("")}</div></div>`;
  await page.setContent(html);
  const client = await page.context().newCDPSession(page);
  await client.send("Performance.enable");
  await page.evaluate(() => { const e = document.getElementById("e"); const p = e.children[Math.floor(e.children.length / 2)]; p.scrollIntoView(); const r = document.createRange(); r.setStart(p.firstChild, 10); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); e.focus(); });
  const lat = [];
  const m0 = await metrics(client);
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => new Promise((res) => { window.__l = new Promise((r2) => addEventListener("keydown", (ev) => { const t = ev.timeStamp; requestAnimationFrame(() => { const c = new MessageChannel(); c.port1.onmessage = () => r2(performance.now() - t); c.port2.postMessage(0); }); }, { once: true, capture: true })); res(); }));
    await page.keyboard.press("x");
    lat.push(Math.round(await page.evaluate(() => window.__l)));
  }
  const m1 = await metrics(client);
  const pk = (k) => Math.round(((m1[k] - m0[k]) * 1000) / 12);
  console.log(String(N).padEnd(6), name.padEnd(20), "median", median(lat), "task", pk("TaskDuration"), "layout", pk("LayoutDuration"), "style", pk("RecalcStyleDuration"), lat.join(","));
  await page.close();
}
await browser.close();
