// CDP trace around a few keystrokes in the middle of fixture@8; prints a breakdown.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { startServer, openPage, SC } from "./lib.mjs";

const OUT = process.argv[2] ?? "perf-results/analysis/pm-view-trace.json";
const { server, url } = await startServer(5211);
const browser = await chromium.launch();
try {
  const { page } = await openPage(browser, url, SC(8));
  const client = await page.context().newCDPSession(page);
  await page.evaluate(() => window.__perf.placeCaret("middle"));
  for (let i = 0; i < 3; i++) { await page.keyboard.press("x"); await page.waitForTimeout(300); } // warm
  const events = [];
  client.on("Tracing.dataCollected", (e) => events.push(...e.value));
  const done = new Promise((r) => client.on("Tracing.tracingComplete", r));
  await client.send("Tracing.start", { transferMode: "ReportEvents", traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.stack", "blink", "v8", "latencyInfo", "input", "blink.user_timing", "toplevel", "cc", "viz"], recordMode: "recordAsMuchAsPossible" } });
  for (let i = 0; i < 5; i++) { await page.keyboard.press("x"); await page.waitForTimeout(500); }
  await client.send("Tracing.end");
  await done;
  writeFileSync(OUT, JSON.stringify(events));
  console.log("events", events.length, "->", OUT);
} finally { await browser.close(); await server.close(); }
