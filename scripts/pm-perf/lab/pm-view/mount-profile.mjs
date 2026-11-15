// CPU profile + CDP metrics of the "mount" stage only (new EditorView + 2 frames), fixture@N.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { startServer, SC, metrics } from "./lib.mjs";
const mb = Number(process.argv[2] ?? 8);
const { server, url } = await startServer(5211);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(0);
  const client = await page.context().newCDPSession(page);
  await client.send("Performance.enable");
  await client.send("Profiler.enable");
  await client.send("Profiler.setSamplingInterval", { interval: 200 });
  let m0, profile; const stages = {};
  await page.exposeFunction("__stageStart", async (name) => { if (name == "mount") { m0 = await metrics(client); await client.send("Profiler.start"); } });
  await page.exposeFunction("__stageEnd", async (name, ms, extra) => {
    stages[name] = ms;
    if (name == "mount") { profile = (await client.send("Profiler.stop")).profile; const m1 = await metrics(client); stages.mountMetrics = Object.fromEntries(["ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "TaskDuration"].map((k) => [k, Math.round((m1[k] - m0[k]) * 1000)])); }
  });
  await page.goto(url); await page.waitForFunction(() => window.__perf);
  await page.evaluate((s) => window.__perf.open(s), SC(mb));
  writeFileSync(`perf-results/analysis/pm-view-mount@${mb}.cpuprofile`, JSON.stringify(profile));
  console.log(JSON.stringify(stages));
  // aggregate
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const dt = profile.timeDeltas; const self = new Map(); const incl = new Map(); let total = 0;
  const name = (n) => `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop().split("?")[0]}:${n.callFrame.lineNumber + 1}`;
  profile.samples.forEach((id, i) => {
    const d = dt[i] / 1000; total += d; const n = byId.get(id); const k = name(n); self.set(k, (self.get(k) ?? 0) + d);
    const seen = new Set(); for (let c = id; c != null; c = parent.get(c)) { const kk = name(byId.get(c)); if (!seen.has(kk)) { seen.add(kk); incl.set(kk, (incl.get(kk) ?? 0) + d); } }
  });
  console.log("total ms", total.toFixed(0));
  console.log("-- self top"); for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(v.toFixed(0).padStart(6), k);
  console.log("-- inclusive (prosemirror/dep funcs)"); for (const [k, v] of [...incl].sort((a, b) => b[1] - a[1]).filter(([k]) => /prosemirror|node_modules|\.vite|Editor|html-block|main/.test(k)).slice(0, 40)) console.log(v.toFixed(0).padStart(6), k);
} finally { await browser.close(); await server.close(); }
