// ProseMirror large-file performance routine.
//
//   npm run perf:pm                       quick suite (a few minutes)
//   npm run perf:pm -- --suite full       adds 32 MB and 100 MB
//   npm run perf:pm -- --only "chunked"   only scenario ids matching a regex
//   npm run perf:pm -- --list             print scenario ids and exit
//   npm run perf:pm -- --repeat 5         override repeats per scenario
//   npm run perf:pm -- --timeout 900      seconds allowed per scenario run
//   npm run perf:pm -- --no-highlight     drop the code-block highlight plugins (full and incremental)
//   npm run perf:pm -- --suite experiments  viewport highlight, spellcheck off, parse in a worker, parse-bound sizes
//   npm run perf:pm -- --suite react      app editor vs @handlewithcare/react-prosemirror (branch react-prosemirror)
//   npm run perf:pm -- --suite react-full the react suite plus 32 MB
//   npm run perf:pm -- --react-dev        React's development build on the react server (default: production,
//                                         which is what users get; the dev build is several times slower)
//   npm run perf:pm -- --channel chromium full Chromium (new headless) instead of the headless shell
//   npm run perf:pm -- --executable <path>  browser binary to launch (or env PM_PERF_CHROMIUM), when the
//                                         Playwright-managed browser for this version is not installed
//   npm run perf:pm -- --force-optimize   re-bundle dependencies first (after changing node_modules)
//   npm run perf:pm -- --profile          save a CPU profile of typing (open it in DevTools)
//   npm run perf:pm -- --strict           exit 1 if a scenario crashes, or if an
//                                         `all` scenario misses a budget
//
// Each run gets a fresh browser, so a crash costs one scenario and no heap carries
// over. Results land in perf-results/ as JSON (every sample) and Markdown (medians).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { createServer } from "vite";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);

const launchOptions = (extra = {}) => ({ channel: option("channel", undefined), executablePath: option("executable", process.env.PM_PERF_CHROMIUM), ...extra });

const BUDGETS = {
  openMs: { limit: 1000, label: "open (read to first paint)" },
  typeP95: { limit: 50, label: "typing p95" },
  scrollP95: { limit: 100, label: "scroll settle p95" },
  blank: { limit: 0, label: "blank viewport after settling" },
  rssMB: { limit: 1024, label: "renderer memory" },
};

const ADDONS = ["none", "input-rules", "keymaps", "cursors", "highlight", "html-nodeview", "all"];
const STRATEGIES = [
  ["full", "all"],
  ["full", "all-no-highlight"],
  ["full", "all-incremental-highlight"],
  ["content-visibility", "all"],
  ["pm-window", "all"],
  ["pm-window", "all-no-highlight"],
  ["pm-window", "all-incremental-highlight"],
  ["chunked", "all"],
  ["monaco", "none"],
];

const isReact = (strategy) => strategy.startsWith("react");

function scenario(strategy, plugins, kind, sizeMB, extra = {}) {
  // react-prosemirror pins prosemirror-view 1.42.3, so its scenarios (and the vanilla baseline on the same
  // version) run on a second dev server in mode "playground-react" (see vite.config.ts).
  const view = isReact(strategy) ? "1.42.3" : extra.view ?? "app";
  const tags = [extra.noSpellcheck && "+nospell", extra.parseInWorker && "+worker"].filter(Boolean).join("");
  const label = view == "1.42.3" && !isReact(strategy) ? `${strategy}[view-1.42.3]` : strategy;
  return { id: `${label}/${plugins}/${kind}@${sizeMB || "fixture"}${tags}`, strategy, plugins, kind, sizeMB, ...(flag("no-highlight") && { noHighlight: true }), ...extra, view };
}

/**
 * The app's editor against @handlewithcare/react-prosemirror, on every corpus:
 *   full                 the app today: prosemirror-view 1.41.0 + the patches in patches/
 *   full[view-1.42.3]    the same vanilla EditorView on the stock 1.42.3 react-prosemirror pins (fair baseline)
 *   react                react-prosemirror, uncontrolled (defaultState), as react-pm/ uses it
 *   react-controlled     react-prosemirror, state lifted into a parent useState
 */
function reactSuite(name) {
  const list = [];
  const contenders = [["full", {}], ["full", { view: "1.42.3" }], ["react", {}], ["react-controlled", {}]];
  // Tables at 0.25 MB: at 2 MB the shared markdown parser (micromark-extension-gfm-table) does not finish in
  // 5 minutes, before any editor is involved, so every variant would only time out.
  const corpora = [["fixture", 0], ["fixture", 2], ["prose", 2], ["lists", 2], ["tables", 0.25], ["fenced", 2], ["html", 2], ["giant-block", 2], ["fixture", 8]];

  for (const [kind, size] of corpora) {
    for (const [strategy, extra] of contenders) list.push(scenario(strategy, "all", kind, size, extra));
  }

  if (name == "react-full") {
    for (const [strategy, extra] of contenders) list.push(scenario(strategy, "all", "fixture", 32, extra));
  }

  return list;
}

/** Follow-ups from the 2026-11 research: deps upgrade, viewport highlight, spellcheck, parse in a worker. */
function experimentsSuite() {
  const list = [];
  // a. Parse-bound scenarios, to rerun after upgrading micromark-extension-gfm-table / mdast-util-from-markdown.
  for (const kind of ["tables", "lists", "prose"]) list.push(scenario("full", "all-no-highlight", kind, 2));
  list.push(scenario("full", "all-no-highlight", "fixture", 8));
  for (const strategy of ["full", "pm-window"]) list.push(scenario(strategy, "all-no-highlight", "fixture", 32));
  // b. Highlight only what is on screen, against the current plugin and the incremental spike.
  for (const plugins of ["all", "all-incremental-highlight", "all-viewport-highlight"]) list.push(scenario("full", plugins, "fenced", 2));
  list.push(scenario("full", "all-incremental-highlight", "fenced", 8, { timeoutSec: 150 }));
  list.push(scenario("full", "all-viewport-highlight", "fenced", 8));
  list.push(scenario("pm-window", "all-viewport-highlight", "fenced", 8));
  list.push(scenario("full", "all", "fixture", 8));
  list.push(scenario("full", "all-viewport-highlight", "fixture", 8));
  list.push(scenario("full", "all-viewport-highlight", "giant-block", 2));
  list.push(scenario("full", "all-viewport-highlight", "fixture", 32));
  // c. spellcheck="false" (meaningful with --channel chromium; the headless shell may not spellcheck at all).
  for (const kind of ["prose", "fixture"]) {
    const size = kind == "prose" ? 2 : 8;
    list.push(scenario("full", "all-no-highlight", kind, size));
    list.push(scenario("full", "all-no-highlight", kind, size, { noSpellcheck: true }));
  }
  // d. Parse in a Web Worker: does the main thread stay responsive, and what does the JSON hop cost?
  list.push(scenario("full", "all-no-highlight", "fixture", 8, { parseInWorker: true }));
  list.push(scenario("full", "all-no-highlight", "fixture", 32, { parseInWorker: true }));
  // e. 100 MB, parse-bound before: does it open now?
  for (const strategy of ["full", "pm-window"]) list.push(scenario(strategy, "all-no-highlight", "fixture", 100));
  return list;
}

function buildSuite(name) {
  if (name == "experiments") return experimentsSuite();
  if (name == "react" || name == "react-full") return reactSuite(name);
  const list = [];

  // 1. What does each add-on cost on the real fixture?
  for (const plugins of ADDONS) list.push(scenario("full", plugins, "fixture", 0, { parseBreakdown: plugins == "all" }));

  // 2. The fixture has no fences and no HTML, so those add-ons need their own corpus.
  for (const plugins of ["none", "highlight", "all"]) list.push(scenario("full", plugins, "fenced", 2));
  for (const plugins of ["none", "html-nodeview", "all"]) list.push(scenario("full", plugins, "html", 2));

  // 3. Which block types are expensive?
  for (const kind of ["prose", "tables", "lists", "giant-block"]) list.push(scenario("full", "all", kind, 2));

  // 4. How does the current editor scale, and what does each strategy change?
  list.push(scenario("full", "all", "fixture", 2));
  // Add-on costs that are invisible at 0.6 MB can dominate here.
  for (const plugins of ADDONS.filter((p) => p != "all")) list.push(scenario("full", plugins, "fixture", 8));
  for (const [strategy, plugins] of STRATEGIES) list.push(scenario(strategy, plugins, "fixture", 8));
  for (const [strategy, plugins] of STRATEGIES) list.push(scenario(strategy, plugins, "fenced", 8));
  for (const [strategy, plugins] of [["pm-window", "all"], ["chunked", "all"]]) list.push(scenario(strategy, plugins, "giant-block", 2));

  if (name == "full") {
    for (const size of [32, 100]) {
      for (const [strategy, plugins] of STRATEGIES) list.push(scenario(strategy, plugins, "fixture", size));
    }
  }

  return list;
}

/** Linux only: Blink's DOM and layout memory is not in the JS heap, so read the process. */
function rendererRssMB() {
  try {
    let max = 0;

    for (const entry of readdirSync("/proc")) {
      if (!/^\d+$/.test(entry)) continue;

      try {
        if (!readFileSync(`/proc/${entry}/cmdline`, "latin1").includes("--type=renderer")) continue;
        const match = /VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${entry}/status`, "latin1"));
        if (match) max = Math.max(max, Number(match[1]) / 1024);
      } catch { /* the process went away */ }
    }

    return max ? Math.round(max) : null;
  } catch {
    return null;
  }
}

const metricsOf = async (client) =>
  Object.fromEntries((await client.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));

const quantile = (values, q) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const median = (values) => quantile(values.filter((v) => v != null), 0.5);

async function runOnce(url, sc, timeoutMs) {
  const result = { status: "ok", stages: {}, typing: {}, scroll: [] };
  const browser = await chromium.launch(launchOptions({ args: ["--enable-precise-memory-info"] }));

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(0);

    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error.message).slice(0, 200)));
    result.pageErrors = pageErrors;

    const client = await page.context().newCDPSession(page);
    await client.send("Performance.enable", { timeDomain: "threadTicks" }).catch(() => client.send("Performance.enable"));

    let before = {};

    await page.exposeFunction("__stageStart", async () => { before = await metricsOf(client); });
    await page.exposeFunction("__stageEnd", async (name, ms, extra) => {
      const after = await metricsOf(client);
      const delta = (key) => Math.round(((after[key] ?? 0) - (before[key] ?? 0)) * 1000);

      result.stages[name] = {
        ms: Math.round(ms),
        scriptMs: delta("ScriptDuration"),
        layoutMs: delta("LayoutDuration"),
        styleMs: delta("RecalcStyleDuration"),
        ...extra,
      };

      await client.send("HeapProfiler.collectGarbage").catch(() => { });

      const settled = await metricsOf(client);
      Object.assign(result.stages[name], {
        heapMB: Math.round((settled.JSHeapUsedSize ?? 0) / 1048576),
        domNodes: settled.Nodes,
        rssMB: rendererRssMB(),
      });
    });

    const work = async () => {
      await page.goto(url);
      await page.waitForFunction(() => window.__perf);

      await page.evaluate((s) => window.__perf.open(s), sc);

      // Save before typing, so the saved bytes can be compared with the untouched original.
      const compare = sc.sizeMB <= 8;
      result.roundTrip = await page.evaluate((c) => window.__perf.save(c), compare).catch((error) => ({ error: String(error.message).slice(0, 200) }));

      await page.evaluate(() => window.__perf.reopen()).catch((error) => { result.reopenError = String(error.message).slice(0, 200); });

      result.copyAllChars = await page.evaluate(() => window.__perf.copyAllLength()).catch(() => null);

      if (flag("profile")) {
        await client.send("Profiler.enable");
        await client.send("Profiler.setSamplingInterval", { interval: 500 });
        await client.send("Profiler.start");
      }

      for (const where of ["start", "middle", "end"]) {
        await page.evaluate((w) => window.__perf.placeCaret(w), where);
        const sizeBefore = await page.evaluate(() => window.__perf.contentSize());
        const samples = [];
        const started = Date.now();
        const metricsBefore = await metricsOf(client);

        for (let i = 0; i < 12 && Date.now() - started < 15_000; i++) {
          await page.evaluate(() => window.__perf.armInput());
          await page.keyboard.press("x");
          samples.push(Math.round(await page.evaluate(() => window.__perf.inputLatency())));
        }

        const sizeAfter = await page.evaluate(() => window.__perf.contentSize());
        const metricsAfter = await metricsOf(client);
        const perKey = (key) => Math.round((((metricsAfter[key] ?? 0) - (metricsBefore[key] ?? 0)) * 1000) / Math.max(1, samples.length));

        result.typing[where] = {
          samples,
          landed: sizeAfter - sizeBefore == samples.length,
          perKeyMs: { script: perKey("ScriptDuration"), layout: perKey("LayoutDuration"), style: perKey("RecalcStyleDuration"), task: perKey("TaskDuration") },
        };
      }

      if (flag("profile")) {
        const { profile } = await client.send("Profiler.stop");
        const path = `perf-results/${sc.id.replace(/[^\w@.-]+/g, "_")}.cpuprofile`;
        writeFileSync(path, JSON.stringify(profile));

        const total = profile.samples.length;
        const self = new Map();
        const byId = new Map(profile.nodes.map((node) => [node.id, node]));

        for (const id of profile.samples) {
          const { functionName, url, lineNumber } = byId.get(id).callFrame;
          const name = `${functionName || "(anonymous)"} ${url.split("/").pop().split("?")[0]}:${lineNumber + 1}`;
          self.set(name, (self.get(name) ?? 0) + 1);
        }

        result.profileTop = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([name, hits]) => `${((hits / total) * 100).toFixed(1)}%  ${name}`);
        console.log(`\n  ${sc.id}: self time while typing (${path})\n    ${result.profileTop.join("\n    ")}`);
        console.log(`    per key: ${JSON.stringify(Object.values(result.typing).map((t) => t.perKeyMs))}`);
      }

      for (const fraction of [0.25, 0.75, 0.5, 0.1, 0.9]) {
        result.scroll.push({ fraction, ...(await page.evaluate((f) => window.__perf.scrollTo(f), fraction)) });
      }

      // Does the caret actually travel through the document with the arrow keys?
      await page.evaluate(() => window.__perf.placeCaret("middle"));
      let moved = 0, previous = await page.evaluate(() => window.__perf.caretOrder());
      const walkStarted = Date.now();
      let presses = 0;

      for (; presses < 40 && Date.now() - walkStarted < 15_000; presses++) {
        await page.keyboard.press("ArrowDown");
        const order = await page.evaluate(() => window.__perf.caretOrder());
        if (order > previous) moved++;
        previous = order;
      }

      result.arrowWalk = { presses, moved };
      result.endRssMB = rendererRssMB();
    };

    let timer;
    const crash = new Promise((_, reject) => page.on("crash", () => reject(new Error("__crash__"))));
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("__timeout__")), timeoutMs); });

    try {
      await Promise.race([work(), crash, timeout]);
    } catch (error) {
      const message = String(error.message);
      result.status = message.includes("__crash__") || /crashed/i.test(message) ? "crashed"
        : message.includes("__timeout__") ? "timeout"
        : "error";
      result.error = message.slice(0, 300);
      result.rssAtFailureMB = rendererRssMB();
    } finally {
      clearTimeout(timer);
    }
  } finally {
    await browser.close().catch(() => { });
  }

  return result;
}

function summarize(sc, runs) {
  const stageNames = [...new Set(runs.flatMap((r) => Object.keys(r.stages)))];
  const stages = Object.fromEntries(stageNames.map((name) => {
    const entries = runs.map((r) => r.stages[name]).filter(Boolean);
    const pick = (key) => median(entries.map((e) => e[key]));
    return [name, {
      ms: pick("ms"), layoutMs: pick("layoutMs"), styleMs: pick("styleMs"), scriptMs: pick("scriptMs"), heapMB: pick("heapMB"), domNodes: pick("domNodes"), rssMB: pick("rssMB"),
      error: entries.find((e) => e.error)?.error,
      chunks: entries[0]?.chunks, topLevelBlocks: entries[0]?.topLevelBlocks, bytes: entries[0]?.bytes,
    }];
  }));

  const ok = runs.filter((r) => r.status == "ok");
  const typing = ok.flatMap((r) => Object.values(r.typing).flatMap((t) => t.samples));
  const openStages = ["index", "read", "parse", "state", "mount"];
  const openMs = openStages.reduce((sum, name) => sum + (stages[name]?.ms ?? 0), 0);

  const summary = {
    id: sc.id,
    status: runs.every((r) => r.status == "ok") ? "ok" : runs.map((r) => r.status).join(","),
    error: runs.find((r) => r.error)?.error,
    runs: runs.length,
    corpusBytes: stages.corpus?.bytes,
    openMs: stages.mount ? openMs : null,
    stages,
    typeP50: quantile(typing, 0.5),
    typeP95: quantile(typing, 0.95),
    typeLanded: ok.length ? ok.every((r) => Object.values(r.typing).every((t) => t.landed)) : null,
    scrollP95: quantile(ok.flatMap((r) => r.scroll.map((s) => s.ms)), 0.95),
    blank: ok.length ? Math.max(0, ...ok.flatMap((r) => r.scroll.map((s) => s.blank))) : null,
    typingPerKeyMs: ok[0]?.typing.middle?.perKeyMs,
    arrowWalk: ok[0]?.arrowWalk,
    roundTrip: runs[0]?.roundTrip,
    copyAllChars: ok[0]?.copyAllChars,
    rssMB: median(runs.map((r) => r.endRssMB ?? r.rssAtFailureMB)),
    pageErrors: [...new Set(runs.flatMap((r) => r.pageErrors))].slice(0, 3),
  };

  summary.overBudget = Object.entries(BUDGETS)
    .filter(([key, budget]) => summary[key] != null && summary[key] > budget.limit)
    .map(([key]) => key);

  return summary;
}

const fmt = (value, unit = "") => (value == null ? "–" : `${Math.round(value).toLocaleString("en-US")}${unit}`);

function writeReport(path, meta, summaries) {
  const lines = [`# ProseMirror performance run`, ``, `${meta.date} · suite \`${meta.suite}\` · ${meta.browser}${meta.noHighlight ? " · **highlight plugins disabled** (--no-highlight)" : ""}${summaries.some((s) => s.id.startsWith("react")) ? ` · React ${meta.reactBuild} build` : ""}`, ``];

  lines.push(`Budgets: ${Object.values(BUDGETS).map((b) => `${b.label} ≤ ${b.limit}`).join(" · ")}. Over-budget values are in **bold**.`, ``);
  lines.push(`| scenario | status | MB | open ms | parse | state | mount | layout+style | save | reopen | type p50 | type p95 | scroll p95 | blank | arrow walk | renderer MB | JS heap MB | DOM nodes |`);
  lines.push(`| --- | --- | ${Array(16).fill("---:").join(" | ")} |`);

  for (const s of summaries) {
    const over = (key, text) => (s.overBudget.includes(key) ? `**${text}**` : text);
    const mount = s.stages.mount;
    const mb = s.corpusBytes ? (s.corpusBytes / 1048576).toFixed(1) : "–";

    lines.push(`| ${s.id} | ${s.status} | ${mb} | ${over("openMs", fmt(s.openMs))} | ${fmt(s.stages.parse?.ms)} | ${fmt(s.stages.state?.ms)} | ${fmt(mount?.ms)} | ${mount ? fmt((mount.layoutMs ?? 0) + (mount.styleMs ?? 0)) : "–"} | ${s.stages.save?.error ? "error" : fmt(s.stages.save?.ms)} | ${fmt(s.stages.reopen?.ms)} | ${fmt(s.typeP50)} | ${over("typeP95", fmt(s.typeP95))} | ${over("scrollP95", fmt(s.scrollP95))} | ${over("blank", s.blank == null ? "–" : s.blank.toFixed(2))} | ${s.arrowWalk ? `${s.arrowWalk.moved}/${s.arrowWalk.presses}` : "–"} | ${over("rssMB", fmt(s.rssMB))} | ${fmt(mount?.heapMB)} | ${fmt(mount?.domNodes)} |`);
  }

  const notes = summaries.filter((s) => s.error || s.stages.save?.error || s.typeLanded === false || s.pageErrors.length || s.roundTrip?.identical === false);

  if (notes.length) {
    lines.push(``, `## Notes`, ``);

    for (const s of notes) {
      const parts = [];
      if (s.error) parts.push(`failed: ${s.error}`);
      if (s.stages.save?.error) parts.push(`save failed: ${s.stages.save.error}`);
      if (s.typeLanded === false) parts.push(`some keystrokes did not land in the document`);
      if (s.roundTrip?.identical === false) parts.push(`saving unedited changes the file: ${fmt(s.roundTrip.originalBytes)} → ${fmt(s.roundTrip.savedBytes)} bytes`);
      if (s.pageErrors.length) parts.push(`page errors: ${s.pageErrors.join(" / ")}`);
      lines.push(`- \`${s.id}\`: ${parts.join("; ")}`);
    }
  }

  writeFileSync(path, lines.join("\n") + "\n");
}

async function main() {
  const suite = option("suite", "quick");
  const only = option("only", null);
  const scenarios = buildSuite(suite).filter((s) => !only || new RegExp(only).test(s.id));

  if (flag("list")) {
    for (const s of scenarios) console.log(s.id);
    return;
  }

  const startServer = async (mode, port) => {
    // Vite's dev server sets NODE_ENV to the mode name, so React (and react-prosemirror's own checks) would
    // run their development builds. Vanilla ProseMirror has no such switch, so measure React as shipped.
    const production = mode == "playground-react" && !flag("react-dev");
    const nodeEnv = { "process.env.NODE_ENV": JSON.stringify("production") };

    const server = await createServer({
      configFile: "vite.config.ts",
      mode,
      logLevel: "error",
      server: { port, fs: { strict: false } },
      ...(production && { define: nodeEnv }),
      // --force-optimize: re-bundle dependencies, e.g. after swapping a package version in node_modules.
      optimizeDeps: { entries: ["pm-perf/index.html"], force: flag("force-optimize") || mode == "playground-react", ...(production && { esbuildOptions: { define: nodeEnv } }) },
    });
    await server.listen();
    return server;
  };

  const servers = [];
  const urls = {};

  // Let Vite discover and pre-bundle everything now: a dependency found mid-run reloads the page.
  console.log("warming up the dev server...");

  if (scenarios.some((s) => s.view != "1.42.3")) {
    const server = await startServer("playground", 5199);
    servers.push(server);
    urls.app = `${server.resolvedUrls.local[0]}pm-perf/`;
    for (const strategy of ["full", "chunked", "monaco"]) {
      await runOnce(urls.app, scenario(strategy, strategy == "monaco" ? "none" : "all", "prose", 0.05), 240_000);
    }
  }

  if (scenarios.some((s) => s.view == "1.42.3")) {
    const server = await startServer("playground-react", 5198);
    servers.push(server);
    urls["1.42.3"] = `${server.resolvedUrls.local[0]}pm-perf/`;
    for (const strategy of ["full", "react", "react-controlled"]) {
      await runOnce(urls["1.42.3"], scenario(strategy, "all", "prose", 0.05, { view: "1.42.3" }), 240_000);
    }
  }

  if (!existsSync("perf-results")) mkdirSync("perf-results");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const browser = await chromium.launch(launchOptions());
  const meta = { date: new Date().toISOString(), suite, reactBuild: flag("react-dev") ? "development" : "production", browser: `Chromium ${browser.version()} headless${option("channel", "") ? ` (channel ${option("channel")})` : ""}`, cpus: (await import("node:os")).cpus().length, noHighlight: flag("no-highlight") };
  await browser.close();

  const summaries = [];
  const raw = [];

  for (const [index, sc] of scenarios.entries()) {
    const repeat = Number(option("repeat", sc.repeat ?? (sc.sizeMB <= 8 ? 3 : 1)));
    const timeoutMs = Number(option("timeout", sc.timeoutSec ?? (sc.sizeMB >= 32 ? 600 : 300))) * 1000;
    const runs = [];

    for (let i = 0; i < repeat; i++) runs.push(await runOnce(urls[sc.view], sc, timeoutMs));

    const summary = summarize(sc, runs);
    summaries.push(summary);
    raw.push({ scenario: sc, runs });

    console.log(`[${index + 1}/${scenarios.length}] ${sc.id}: ${summary.status} · open ${fmt(summary.openMs, "ms")} · type p95 ${fmt(summary.typeP95, "ms")} · ${fmt(summary.rssMB, "MB")}`);

    // Written after every scenario, so an interrupted run still leaves a report.
    writeFileSync(`perf-results/${stamp}.json`, JSON.stringify({ meta, summaries, raw }, null, 1));
    writeReport(`perf-results/${stamp}.md`, meta, summaries);
  }

  for (const server of servers) await server.close();

  console.log(`\nreport: perf-results/${stamp}.md`);

  const failures = summaries.filter((s) => s.status != "ok" || (s.overBudget.length && s.id.includes("/all/")));

  if (flag("strict") && failures.length) {
    console.error(`${failures.length} scenario(s) failed or missed a budget`);
    process.exitCode = 1;
  }
}

main().then(() => process.exit(process.exitCode ?? 0), (error) => {
  console.error(error);
  process.exit(1);
});
