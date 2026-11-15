import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const N = 37800, text = "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ".repeat(2).slice(0, 220);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.setContent(`<style>html,body{margin:0}#s{position:fixed;inset:0;overflow:auto}#e{padding:6px 12px;white-space:pre-wrap;outline:none}</style><div id=s><div id=e contenteditable>${Array.from({ length: N }, (_, i) => `<p>${i} ${text}</p>`).join("")}</div></div>`);
await page.evaluate(() => { const e = document.getElementById("e"); const p = e.children[e.children.length >> 1]; p.scrollIntoView(); const r = document.createRange(); r.setStart(p.firstChild, 10); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); e.focus(); });
const client = await page.context().newCDPSession(page);
for (let i = 0; i < 3; i++) { await page.keyboard.press("x"); await page.waitForTimeout(300); }
const events = []; client.on("Tracing.dataCollected", (e) => events.push(...e.value));
const done = new Promise((r) => client.on("Tracing.tracingComplete", r));
await client.send("Tracing.start", { transferMode: "ReportEvents", traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "blink", "v8", "latencyInfo", "input", "toplevel", "cc", "viz"] } });
for (let i = 0; i < 5; i++) { await page.keyboard.press("x"); await page.waitForTimeout(500); }
await client.send("Tracing.end"); await done;
writeFileSync(process.argv[2], JSON.stringify(events)); await browser.close();
