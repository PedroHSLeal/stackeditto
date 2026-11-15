// node scripts/pm-perf/lab/open-parallel/run.mjs <experiment> '<json array of args>' [repeat]
// Own Vite server (port 5212, strictPort) + Playwright. LAB_REAL_SHIKI=1 keeps the real Shiki module (worker boot baseline).
// Each call to an experiment runs in a fresh browser; the dev server warms itself first.
import { chromium } from "playwright";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const experiment = process.argv[2];
const args = process.argv[3] ? JSON.parse(process.argv[3]) : [];
const repeat = Number(process.argv[4] ?? 1);
const real = process.env.LAB_REAL_SHIKI == "1";
const stubPath = fileURLToPath(new URL("../../../../playground/open-parallel-lab/shiki-stub.ts", import.meta.url));

const stubShiki = {
  name: "lab-stub-shiki",
  enforce: "pre",
  resolveId(source) {
    if (!real && /shiki-code-block$/.test(source)) return stubPath;
  },
};

const server = await createServer({
  configFile: "vite.config.ts", mode: "playground", logLevel: "error",
  server: { port: 5212, strictPort: true, fs: { strict: false } },
  plugins: [stubShiki],
  optimizeDeps: { entries: ["open-parallel-lab/index.html"] },
});
await server.listen();
const url = `${server.resolvedUrls.local[0]}open-parallel-lab/`;

async function once(name = experiment, a = args) {
  const browser = await chromium.launch({ args: ["--enable-precise-memory-info"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(0);
    page.on("pageerror", (e) => console.error("pageerror:", String(e.message).slice(0, 200)));
    await page.goto(url);
    await page.waitForFunction(() => window.__labReady, null, { timeout: 180000 });
    return await page.evaluate(([name, a]) => window.__lab[name](...a), [name, a]);
  } finally {
    await browser.close().catch(() => { });
  }
}

try {
  if (process.env.LAB_WARM != "0") await once("parallelOpen", ["prose", 0.05, 2, 16]).catch((e) => console.error("warm", e.message)); // warm-up run: dependency discovery
  for (let i = 0; i < repeat; i++) console.log(JSON.stringify(await once()));
} finally {
  await server.close();
}
