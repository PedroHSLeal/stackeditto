// Trace of the mount stage: which Layout / UpdateLayoutTree / Paint events happen and who forced them.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { startServer, SC } from "./lib.mjs";
const { server, url } = await startServer(5211);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(0);
  const client = await page.context().newCDPSession(page);
  const events = []; client.on("Tracing.dataCollected", (e) => events.push(...e.value));
  const done = new Promise((r) => client.on("Tracing.tracingComplete", r));
  await page.exposeFunction("__stageStart", async (name) => { if (name == "mount") await client.send("Tracing.start", { transferMode: "ReportEvents", traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.stack", "v8", "blink", "toplevel"] } }); });
  await page.exposeFunction("__stageEnd", async (name) => { if (name == "mount") { await client.send("Tracing.end"); await done; } });
  await page.goto(url); await page.waitForFunction(() => window.__perf);
  await page.evaluate((s) => window.__perf.open(s), SC(Number(process.argv[2] ?? 8)));
  writeFileSync("perf-results/analysis/pm-view-mount-trace.json", JSON.stringify(events));
  const want = ["Layout", "UpdateLayoutTree", "Paint", "PrePaint", "Layerize", "HitTest", "FunctionCall", "EvaluateScript", "RunTask", "ParseHTML", "UpdateLifecycle", "FrameSelection::SetSelection"];
  for (const e of events.filter((e) => e.ph == "X" && e.dur > 3000 && (want.includes(e.name) || e.name.startsWith("Blink.")))) {
    const sf = e.args?.beginData?.stackTrace ?? e.args?.data?.stackTrace;
    console.log(e.name.padEnd(28), (e.dur / 1000).toFixed(0).padStart(6), e.args?.data?.functionName ?? "", sf ? sf.slice(0, 4).map((s) => `${s.functionName}@${s.url.split("/").pop().split("?")[0]}:${s.lineNumber}`).join(" < ") : "");
  }
} finally { await browser.close(); await server.close(); }
