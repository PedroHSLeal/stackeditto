// CPU profile of keystrokes only (caret placement excluded) at fine sampling.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { startServer, openPage, SC } from "./lib.mjs";
const mb = Number(process.argv[2] ?? 8);
const { server, url } = await startServer(5211);
const browser = await chromium.launch();
try {
  const { page } = await openPage(browser, url, SC(mb));
  const client = await page.context().newCDPSession(page);
  await client.send("Profiler.enable"); await client.send("Profiler.setSamplingInterval", { interval: 100 });
  await page.evaluate(() => window.__perf.placeCaret("middle"));
  for (let i = 0; i < 3; i++) { await page.keyboard.press("x"); await page.waitForTimeout(200); }
  await client.send("Profiler.start");
  for (let i = 0; i < 12; i++) { await page.evaluate(() => window.__perf.armInput()); await page.keyboard.press("x"); await page.evaluate(() => window.__perf.inputLatency()); }
  const { profile } = await client.send("Profiler.stop");
  writeFileSync(`perf-results/analysis/pm-view-keys@${mb}.cpuprofile`, JSON.stringify(profile));
} finally { await browser.close(); await server.close(); }
