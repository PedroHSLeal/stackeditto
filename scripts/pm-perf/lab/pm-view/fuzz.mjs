// node scripts/pm-perf/lab/pm-view/fuzz.mjs [seeds] [steps]
// Equivalence fuzz of the patched prosemirror-view against the installed one, in a real browser.
import { chromium } from "playwright";
import { createServer } from "vite";
import { resolve } from "node:path";
const seeds = Number(process.argv[2] ?? 20), steps = Number(process.argv[3] ?? 60);
const patched = resolve("scripts/pm-perf/lab/pm-view/patched/prosemirror-view/dist/index.js").replace(/\\/g, "/");
const orig = resolve("node_modules/prosemirror-view/dist/index.js").replace(/\\/g, "/");
const server = await createServer({
  configFile: "vite.config.ts", mode: "playground", logLevel: "error", cacheDir: "node_modules/.vite-lab-pm-view-fuzz",
  resolve: { alias: [{ find: /^pm-view-orig$/, replacement: orig }, { find: /^prosemirror-view$/, replacement: patched }] },
  server: { port: 5211, strictPort: true, fs: { strict: false } },
  optimizeDeps: { entries: ["pm-view-lab/index.html"], force: true },
});
await server.listen();
const url = `${server.resolvedUrls.local[0]}pm-view-lab/`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => m.type() == "error" && errs.push(m.text()));
  await page.goto(url);
  await page.waitForFunction(() => window.__fuzz, null, { timeout: 120000 });
  let bad = 0, total = 0;
  for (const mode of (process.argv[4] ?? "plain,deco,nodedeco,widget").split(",")) {
    for (let seed = Number(process.argv[5] ?? 1); seed <= seeds; seed++) {
      const f = await page.evaluate(([s, n, m]) => window.__fuzz(s, n, m), [seed, steps, mode]);
      total++;
      if (f.length) { bad++; console.log("FAIL", mode, seed, f.slice(0, 3)); }
    }
    console.log(mode, "done");
  }
  console.log(`fuzz: ${total - bad}/${total} runs equivalent`, errs.slice(0, 3));
} finally { await browser.close(); await server.close(); }
