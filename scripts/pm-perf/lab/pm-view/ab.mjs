// A/B (interleaved ABAB) of the installed prosemirror-view vs a patched copy on the pm-perf page.
//   node scripts/pm-perf/lab/pm-view/ab.mjs [mb=8] [pairs=4] [keys=12] [variantDir=patched/prosemirror-view/dist/index.js]
import { chromium } from "playwright";
import { createServer } from "vite";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { SC, metrics, median } from "./lib.mjs";

const mb = Number(process.argv[2] ?? 8), pairs = Number(process.argv[3] ?? 4), keys = Number(process.argv[4] ?? 12);
const variantFile = resolve("scripts/pm-perf/lab/pm-view", process.argv[5] ?? "patched/prosemirror-view/dist/index.js").replace(/\\/g, "/");

async function serve(port, alias) {
  const server = await createServer({
    configFile: "vite.config.ts", mode: "playground", logLevel: "error", cacheDir: `node_modules/.vite-lab-pm-view-ab-${port}`,
    resolve: { alias: alias ? [{ find: /^prosemirror-view$/, replacement: alias }] : [] },
    server: { port, strictPort: true, fs: { strict: false } },
    optimizeDeps: { entries: ["pm-perf/index.html"], force: true },
  });
  await server.listen();
  return { server, url: `${server.resolvedUrls.local[0]}pm-perf/` };
}

const A = await serve(5211, null), B = await serve(5241, variantFile);
const browser = await chromium.launch();

async function run(url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(0);
  const client = await page.context().newCDPSession(page);
  await client.send("Performance.enable");
  const stages = {};
  await page.exposeFunction("__stageStart", async () => { });
  await page.exposeFunction("__stageEnd", async (name, ms) => { stages[name] = Math.round(ms); });
  await page.goto(url);
  await page.waitForFunction(() => window.__perf);
  await page.evaluate((s) => window.__perf.open(s), SC(mb));
  const out = { mount: stages.mount, typing: {} };
  out.roundTrip = await page.evaluate(() => window.__perf.save(mb <= 8)).catch(() => null);
  for (const where of ["start", "middle", "end"]) {
    await page.evaluate((w) => window.__perf.placeCaret(w), where);
    const before = await page.evaluate(() => window.__perf.contentSize());
    const m0 = await metrics(client);
    const lat = [];
    for (let i = 0; i < keys; i++) {
      await page.evaluate(() => window.__perf.armInput());
      await page.keyboard.press("x");
      lat.push(Math.round(await page.evaluate(() => window.__perf.inputLatency())));
    }
    const m1 = await metrics(client);
    const after = await page.evaluate(() => window.__perf.contentSize());
    const pk = (k) => ((m1[k] - m0[k]) * 1000) / keys;
    out.typing[where] = { lat, landed: after - before == keys, script: pk("ScriptDuration"), task: pk("TaskDuration"), layout: pk("LayoutDuration") };
  }
  out.savedAfter = await page.evaluate(() => window.__perf.save(false)).then((r) => r.savedBytes).catch(() => null);
  await page.close();
  return out;
}

const results = { A: [], B: [] };
try {
  for (let i = 0; i < pairs; i++) {
    for (const [name, srv] of (i % 2 ? [["B", B], ["A", A]] : [["A", A], ["B", B]])) {
      const r = await run(srv.url);
      results[name].push(r);
      console.log(`pair ${i} ${name}: mount ${r.mount} | ` + Object.entries(r.typing).map(([w, t]) => `${w} med ${median(t.lat)} script ${t.script.toFixed(1)} task ${t.task.toFixed(0)}${t.landed ? "" : " NOT-LANDED"}`).join(" | ") + ` | saved ${r.savedAfter} identical0=${r.roundTrip?.identical}`);
    }
  }
  writeFileSync(`perf-results/analysis/pm-view-ab-${mb}mb-${Date.now()}.json`, JSON.stringify(results));
  console.log("\n== medians over runs (A = installed 1.41.0, B = patched) ==");
  for (const where of ["start", "middle", "end"]) {
    for (const [name, rs] of Object.entries(results)) {
      const all = rs.flatMap((r) => r.typing[where].lat);
      console.log(where.padEnd(7), name, "latency median", median(all), "n=" + all.length, "| script ms/key", median(rs.map((r) => r.typing[where].script)).toFixed(2), "| task ms/key", median(rs.map((r) => r.typing[where].task)).toFixed(1));
    }
  }
  for (const [name, rs] of Object.entries(results)) console.log(name, "mount median", median(rs.map((r) => r.mount)), "savedAfter", [...new Set(rs.map((r) => r.savedAfter))].join(","));
} finally {
  await browser.close(); await A.server.close(); await B.server.close();
}
