// Shared helpers for the pm-view lab. Run from the repo root: node scripts/pm-perf/lab/pm-view/<script>.mjs
import { chromium } from "playwright";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

export const SC = (mb = 8, strategy = "full") => ({ id: `${strategy}/all-no-highlight/fixture@${mb}`, strategy, plugins: "all-no-highlight", kind: "fixture", sizeMB: mb });

/** Vite playground server; aliasView = absolute path of a patched prosemirror-view (dir or file) or null. */
export async function startServer(port, aliasView = null, aliasModel = null) {
  const alias = [];
  if (aliasView) alias.push({ find: /^prosemirror-view$/, replacement: aliasView });
  if (aliasModel) alias.push({ find: /^prosemirror-model$/, replacement: aliasModel });
  const server = await createServer({
    configFile: "vite.config.ts", mode: "playground", logLevel: "error",
    cacheDir: `node_modules/.vite-lab-pm-view-${port}`,
    resolve: { alias },
    server: { port, strictPort: true, fs: { strict: false } },
    optimizeDeps: { entries: ["pm-perf/index.html"], force: true },
  });
  await server.listen();
  return { server, url: `${server.resolvedUrls.local[0]}pm-perf/` };
}

export async function openPage(browser, url, sc) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(0);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
  const stages = {};
  await page.exposeFunction("__stageStart", async () => { });
  await page.exposeFunction("__stageEnd", async (name, ms, extra) => { stages[name] = { ms: Math.round(ms), ...extra }; });
  await page.goto(url);
  await page.waitForFunction(() => window.__perf);
  await page.evaluate((s) => window.__perf.open(s), sc);
  return { page, errors, stages };
}

export async function metrics(client) {
  return Object.fromEntries((await client.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
}

/** Type n 'x' keys at where; returns latencies + per-key CDP metric deltas + landed flag. */
export async function typeKeys(page, client, where, n = 12) {
  await page.evaluate((w) => window.__perf.placeCaret(w), where);
  const before = await page.evaluate(() => window.__perf.contentSize());
  const m0 = await metrics(client);
  const samples = [];
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => window.__perf.armInput());
    await page.keyboard.press("x");
    samples.push(Math.round(await page.evaluate(() => window.__perf.inputLatency())));
  }
  const m1 = await metrics(client);
  const after = await page.evaluate(() => window.__perf.contentSize());
  const pk = (k) => Math.round(((m1[k] - m0[k]) * 1000) / n);
  return { samples, landed: after - before == n, perKey: { task: pk("TaskDuration"), script: pk("ScriptDuration"), layout: pk("LayoutDuration"), style: pk("RecalcStyleDuration") } };
}
