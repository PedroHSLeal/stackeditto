// Does a key typed right after a caret move land where the caret is?   node scripts/pm-perf/react-race.mjs
//
// Found while testing react-pm/: with @handlewithcare/react-prosemirror, click + End + typing with no pause
// inserted the text at the *previous* selection (once replacing a whole heading). This replays that against
// the app's editor, the same vanilla EditorView on prosemirror-view 1.42.3, and react-prosemirror.
//
//   --trials 20        sequences per pause and editor
//   --executable path  browser binary (or env PM_PERF_CHROMIUM), as in run.mjs
import { chromium } from "playwright";
import { createServer } from "vite";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const TRIALS = Number(option("trials", 20));
const PAUSES = [0, 10, 30, 100];

const EDITORS = [
  { label: "app (1.41.0 + patches)", mode: "playground", strategy: "full", view: "app" },
  { label: "vanilla 1.42.3", mode: "playground-react", strategy: "full", view: "1.42.3" },
  { label: "react-prosemirror", mode: "playground-react", strategy: "react", view: "1.42.3" },
  { label: "react-prosemirror (controlled)", mode: "playground-react", strategy: "react-controlled", view: "1.42.3" },
];

const production = { "process.env.NODE_ENV": JSON.stringify("production") };
const servers = {};

for (const [mode, port] of [["playground", 5197], ["playground-react", 5196]]) {
  const react = mode == "playground-react";
  const server = await createServer({
    configFile: "vite.config.ts", mode, logLevel: "error", server: { port, fs: { strict: false } },
    ...(react && { define: production }),
    optimizeDeps: { entries: ["pm-perf/index.html"], force: react, ...(react && { esbuildOptions: { define: production } }) },
  });
  await server.listen();
  servers[mode] = server;
}

const browser = await chromium.launch({ executablePath: option("executable", process.env.PM_PERF_CHROMIUM) });

/** Two sequences that move the caret natively (so the editor learns it from selectionchange) and type at once. */
const SEQUENCES = {
  "click + End + type": async (page, pause) => {
    const before = await page.$eval("#mount h2", (e) => e.textContent);
    const box = await (await page.$("#mount h2")).boundingBox();
    await page.mouse.click(box.x + 10, box.y + box.height / 2);
    await page.keyboard.press("End");
    if (pause) await page.waitForTimeout(pause);
    await page.keyboard.type("XY");
    await page.waitForTimeout(150);
    const after = await page.$eval("#mount h2", (e) => e.textContent);
    return after == before + "XY" ? null : `heading ${JSON.stringify(before.slice(-20))} → ${JSON.stringify(after.slice(-24))}`;
  },
  "End + ArrowDown + type": async (page, pause) => {
    const box = await (await page.$("#mount h2")).boundingBox();
    await page.mouse.click(box.x + 10, box.y + box.height / 2);
    await page.waitForTimeout(100);
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowDown");
    if (pause) await page.waitForTimeout(pause);
    const heading = await page.$eval("#mount h2", (e) => e.textContent);
    await page.keyboard.type("Z");
    await page.waitForTimeout(150);
    const headingAfter = await page.$eval("#mount h2", (e) => e.textContent);
    const paragraph = await page.$eval("#mount h2 + p", (e) => e.textContent);
    return headingAfter == heading && paragraph.includes("Z") ? null : `Z landed in the heading (${JSON.stringify(headingAfter.slice(-12))})`;
  },
};

console.log(`editor | sequence | ${PAUSES.map((p) => `${p} ms pause`).join(" | ")}`);
console.log(`--- | --- | ${PAUSES.map(() => "---:").join(" | ")}`);

const examples = [];

for (const editor of EDITORS) {
  for (const [name, run] of Object.entries(SEQUENCES)) {
    const cells = [];

    for (const pause of PAUSES) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      // The harness page reports each stage to run.mjs; here nobody is timing, so the bindings are no-ops.
      await page.addInitScript(() => { window.__stageStart = async () => { }; window.__stageEnd = async () => { }; });
      await page.goto(`${servers[editor.mode].resolvedUrls.local[0]}pm-perf/`);
      await page.waitForFunction(() => window.__perf);
      await page.evaluate((sc) => window.__perf.open(sc), { id: "race", strategy: editor.strategy, plugins: "all", kind: "prose", sizeMB: 0.02, view: editor.view });
      await page.waitForTimeout(300);

      let ok = 0;
      for (let i = 0; i < TRIALS; i++) {
        const problem = await run(page, pause);
        if (!problem) ok++;
        else if (examples.length < 12) examples.push(`${editor.label} · ${name} · ${pause} ms: ${problem}`);
      }

      cells.push(`${ok}/${TRIALS}`);
      await page.close();
    }

    console.log(`${editor.label} | ${name} | ${cells.join(" | ")}`);
  }
}

if (examples.length) console.log(`\nexamples:\n- ${examples.join("\n- ")}`);

await browser.close();
for (const server of Object.values(servers)) await server.close();
process.exit(0);
