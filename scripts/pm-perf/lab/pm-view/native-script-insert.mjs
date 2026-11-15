// Same page, but the key is handled by script (preventDefault on beforeinput; mutate text node; set selection) - what PM does when handleTextInput claims the key.
import { chromium } from "playwright";
import { median } from "./lib.mjs";
const N = 37800, text = "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ".repeat(2).slice(0, 220);
const browser = await chromium.launch();
for (const mode of ["native", "script-setdata+setBaseAndExtent", "script-setdata-only"]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.setContent(`<style>html,body{margin:0}#s{position:fixed;inset:0;overflow:auto}#e{padding:6px 12px;white-space:pre-wrap;outline:none}</style><div id=s><div id=e contenteditable>${Array.from({ length: N }, (_, i) => `<p>${i} ${text}</p>`).join("")}</div></div>`);
  await page.evaluate((mode) => {
    const e = document.getElementById("e"); const p = e.children[N2()]; function N2() { return e.children.length >> 1; }
    p.scrollIntoView(); const r = document.createRange(); r.setStart(p.firstChild, 10); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); e.focus();
    if (mode != "native") e.addEventListener("beforeinput", (ev) => {
      if (ev.inputType != "insertText") return; ev.preventDefault();
      const s = getSelection(); const n = s.anchorNode, o = s.anchorOffset;
      n.nodeValue = n.nodeValue.slice(0, o) + ev.data + n.nodeValue.slice(o);
      if (mode.includes("setBase")) s.setBaseAndExtent(n, o + 1, n, o + 1);
    });
  }, mode);
  const lat = [];
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => { window.__l = new Promise((r2) => addEventListener("keydown", (ev) => { const t = ev.timeStamp; requestAnimationFrame(() => { const c = new MessageChannel(); c.port1.onmessage = () => r2(performance.now() - t); c.port2.postMessage(0); }); }, { once: true, capture: true })); });
    await page.keyboard.press("x");
    lat.push(Math.round(await page.evaluate(() => window.__l)));
  }
  console.log(mode.padEnd(36), "median", median(lat), lat.join(","));
  await page.close();
}
await browser.close();
