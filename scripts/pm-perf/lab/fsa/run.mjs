// FSA lab driver: node scripts/pm-perf/lab/fsa/run.mjs --reps 5 --out <file.json>
import { chromium } from "playwright";
import { createServer } from "vite";
import { writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const reps = +opt("reps", 5);
const outFile = opt("out", "fsa-results.json");
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const stat = v => ({ median: +med(v).toFixed(2), min: +Math.min(...v).toFixed(2), max: +Math.max(...v).toFixed(2), samples: v.length });
const server = await createServer({ configFile: "vite.config.ts", mode: "playground", logLevel: "error", server: { port: 5214, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ["--enable-precise-memory-info"] });
const res = { meta: { chromium: browser.version(), reps, date: new Date().toISOString() }, tree: {}, big: {} };
try {
  const page = await browser.newPage();
  page.on("pageerror", e => console.error("pageerror", e.message));
  await page.goto("http://localhost:5214/fsa-lab/");
  await page.waitForFunction(() => window.lab?.ready, null, { timeout: 120000 });
  await page.evaluate(() => lab.clear());
  const time = (fn, ...a) => page.evaluate(async ([fn, a]) => { const t = performance.now(); const r = await lab[fn](...a); return { ms: performance.now() - t, r }; }, [fn, a]);
  const sizes = [["w1k", 1000, 50, 2000], ["w10k", 10000, 100, 5000]];
  for (const [name, n, dirs, git] of sizes) {
    const b = await page.evaluate(([a, b, c, d]) => lab.build(a, b, c, d), [name, n, dirs, git]);
    console.log("built", name, b);
    const variants = [["appGetFiles", [name]], ["seqNoGetFile", [name]], ["parNoGetFile", [name, 8]], ["parNoGetFile", [name, 32]], ["parWithGetFile", [name, 8]], ["lazyRoot", [name]], ["lazyExpand", [name]]];
    const acc = {}; const counts = {};
    await time("appGetFiles", name); // warmup
    for (let i = 0; i < reps; i++) for (const [v, a] of variants) { const k = v + (a[1] ? `@${a[1]}` : ""); const r = await time(v, ...a); (acc[k] ??= []).push(r.ms); counts[k] = r.r; }
    const cr = { create: [], full: [], oneDir: [] };
    for (let i = 0; i < reps; i++) {
      const c = await page.evaluate(async ([name, i]) => {
        const t0 = performance.now(); await lab.createOne(name, i); const t1 = performance.now();
        await lab.appGetFiles(name); const t2 = performance.now();
        const nOne = await lab.relistOne(name); const t3 = performance.now();
        return { create: t1 - t0, full: t2 - t1, oneDir: t3 - t2, nOne };
      }, [name, Date.now() % 1e9 + i]);
      cr.create.push(c.create); cr.full.push(c.full); cr.oneDir.push(c.oneDir); cr.nOne = c.nOne;
    }
    const heap = await page.evaluate(async name => { const h0 = lab.heap(); const keep = []; for (let i = 0; i < 1; i++) keep.push(await lab.appGetFiles(name)); return { h0, h1: lab.heap() }; }, name);
    res.tree[name] = { n, git, variants: Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, stat(v)])), counts, createReload: { create: stat(cr.create), full: stat(cr.full), oneDir: stat(cr.oneDir), filesInOneDir: cr.nOne } };
    console.log(name, JSON.stringify(res.tree[name], null, 1));
  }
  for (const mb of [8, 32]) {
    const sz = await page.evaluate(mb => lab.makeBig(mb), mb);
    const out = { size: sz };
    const modes = ["main-text", "main-stream", "worker-text", "worker-stream"]; const acc = {};
    for (let i = 0; i < reps; i++) for (const m of modes) { const r = await page.evaluate(([mb, m]) => lab.readBig(mb, m), [mb, m]); (acc[m] ??= []).push(r); }
    out.read = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, { ms: stat(v.map(x => x.ms)), maxBlock: stat(v.map(x => x.maxBlock)) }]));
    const wm = ["full", "blob", "chunked", "swap"]; const wacc = {};
    for (let i = 0; i < reps; i++) for (const m of wm) { await page.evaluate(() => lab.clearOut()); const r = await page.evaluate(([mb, m]) => lab.writeBig(mb, m), [mb, m]); (wacc[m] ??= []).push(r); }
    out.write = Object.fromEntries(Object.entries(wacc).map(([k, v]) => [k, { ms: stat(v.map(x => x.ms)), maxBlock: stat(v.map(x => x.maxBlock)) }]));
    res.big[mb] = out; console.log(mb, JSON.stringify(out, null, 1));
  }
  const rn = { copy: [], move: [] };
  for (let i = 0; i < 3; i++) rn.copy.push((await page.evaluate(() => lab.renameCopy("w1k"))).ms);
  try { for (let i = 0; i < 3; i++) rn.move.push((await page.evaluate(() => lab.renameMove("w1k"))).ms); } catch (e) { rn.moveErr = String(e).slice(0, 200); }
  res.rename = { copy: stat(rn.copy), move: rn.move.length ? stat(rn.move) : null, moveErr: rn.moveErr, note: "1 dir of ~20 files (w1k: 50 dirs x 20 files)" };
  console.log(JSON.stringify(res.rename));
} finally {
  writeFileSync(outFile, JSON.stringify(res, null, 1));
  await browser.close(); await server.close();
}
