// File System Access benchmark: OPFS x local folder (showDirectoryPicker backend) x stream reads.
//
//   npm run perf:fs                                    every stage
//   npm run perf:fs -- --stages capabilities,read-file only these stages (in the order of STAGES)
//   npm run perf:fs -- --first 2                       only the first N stages
//   npm run perf:fs -- --sizes 4k,64k,1m               file sizes for read-file / write (4k 64k 1m 8m 32m 128m)
//   npm run perf:fs -- --subjects opfs                 opfs and/or local
//   npm run perf:fs -- --repeat 7                      samples per case (after one warm-up)
//   npm run perf:fs -- --workspace-files 2000          notes in the read-workspace vault
//   npm run perf:fs -- --only "stream"                 only case ids matching a regex
//   npm run perf:fs -- --list                          print case ids and exit
//   npm run perf:fs -- --keep                          keep the temp profile and fixture folder
//
// showDirectoryPicker() opens a native dialog that no automation can click through, so the
// "local" subject gets its handle the other way Chromium hands out a real-disk handle: a folder
// dropped on the page (CDP Input.dispatchDragEvent + DataTransferItem.getAsFileSystemHandle()).
// Both go through the same local backend; the dropped handle is read-only, so `write` on
// "local" is skipped. To measure the picker itself, open the page (npm run playground →
// /fs-bench/) and use its buttons.
//
// The browser runs with a persistent profile on disk: Playwright's default contexts are
// off-the-record, and an incognito OPFS lives in memory, which would flatter OPFS.
import { cpus, tmpdir } from "node:os";
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, rmSync, statSync, writeSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { DEFAULT_OPTIONS, FIXTURE_DIR, SIZES, STAGES, chunksOf, fixtureSpec, plan, toMarkdown } from "../../playground/fs-bench/shared.ts";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const list = (name, fallback) => option(name, null)?.split(",").map((s) => s.trim()).filter(Boolean) ?? fallback;

function readOptions() {
  let stages = list("stages", [...STAGES]);
  if (option("first", null)) stages = STAGES.slice(0, Number(option("first")));

  const options = {
    ...DEFAULT_OPTIONS,
    stages: STAGES.filter((s) => stages.includes(s)),
    subjects: list("subjects", ["opfs", "local"]).filter((s) => s == "opfs" || s == "local"),
    sizes: list("sizes", Object.keys(SIZES)),
    repeat: Number(option("repeat", DEFAULT_OPTIONS.repeat)),
    workspaceFiles: Number(option("workspace-files", DEFAULT_OPTIONS.workspaceFiles)),
  };

  for (const size of options.sizes) if (!(size in SIZES)) throw new Error(`tamanho desconhecido: ${size} (use ${Object.keys(SIZES).join(", ")})`);
  return options;
}

/** The project pins its own Playwright; fall back to a preinstalled Chromium when its browser is not downloaded. */
function executablePath() {
  if (process.env.FS_BENCH_CHROMIUM) return process.env.FS_BENCH_CHROMIUM;
  if (existsSync(chromium.executablePath())) return undefined;
  return existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
}

/** Same bytes the page writes into OPFS (shared.ts), written by Node into a real folder. */
function writeLocalFixtures(root, options) {
  let written = 0;

  for (const { path, bytes } of fixtureSpec(options)) {
    const target = join(root, path);
    if (existsSync(target) && statSync(target).size == bytes) continue;
    mkdirSync(dirname(target), { recursive: true });
    const fd = openSync(target, "w");
    for (const chunk of chunksOf(bytes)) writeSync(fd, chunk);
    closeSync(fd);
    written++;
  }

  return written;
}

function dirSizeMB(path) {
  let total = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else total += statSync(full).size;
    }
  };
  if (existsSync(path)) walk(path);
  return Math.round(total / 1048576);
}

async function dropFolder(page, folder) {
  const cdp = await page.context().newCDPSession(page);
  const data = { items: [], files: [folder], dragOperationsMask: 1 };
  for (const type of ["dragEnter", "dragOver", "drop"]) await cdp.send("Input.dispatchDragEvent", { type, x: 20, y: 20, data });
  await page.waitForFunction(() => document.body.dataset.local == "ready", null, { timeout: 10_000 });
}

const fmtMs = (v) => (v == null ? "–" : v < 100 ? v.toFixed(2) : Math.round(v).toString());
const median = (values) => { const s = values.filter((v) => v != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

async function main() {
  const options = readOptions();
  const only = option("only", null);
  const cases = plan(options).filter((c) => !only || new RegExp(only).test(c.id));

  if (flag("list")) {
    for (const c of cases) console.log(c.id);
    return;
  }

  const server = await createServer({
    configFile: "vite.config.ts",
    mode: "playground",
    logLevel: "error",
    server: { port: 5198, fs: { strict: false } },
    optimizeDeps: { entries: ["fs-bench/index.html"] },
  });

  await server.listen();
  const url = `${server.resolvedUrls.local[0]}fs-bench/`;

  const work = mkdtempSync(join(tmpdir(), "stackeditto-fs-bench-"));
  const profile = join(work, "profile");
  const localRoot = join(work, FIXTURE_DIR);
  mkdirSync(localRoot, { recursive: true });

  if (options.subjects.includes("local")) {
    const started = Date.now();
    console.log(`fixtures locais: ${writeLocalFixtures(localRoot, options)} arquivos em ${localRoot} (${Date.now() - started} ms)`);
  }

  const context = await chromium.launchPersistentContext(profile, {
    executablePath: executablePath(),
    viewport: { width: 1000, height: 700 },
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const meta = {
    date: new Date().toISOString(),
    browser: `Chromium ${context.browser()?.version() ?? ""} headless, perfil persistente em disco, ${cpus().length} CPUs`.replace("  ", " "),
    options,
    notes: [
      `"local" = pasta real solta na pagina via CDP (mesmo backend do showDirectoryPicker, somente leitura). Para medir o picker em si, use a pagina /fs-bench/ no playground.`,
      `As fixtures acabaram de ser escritas, entao as leituras sao com page cache quente (OPFS e local igualmente).`,
    ],
  };

  const results = [];
  const writeReport = () => {
    if (!existsSync("perf-results")) mkdirSync("perf-results");
    writeFileSync(`perf-results/fs-bench-${stamp}.json`, JSON.stringify({ meta, results }, null, 1));
    writeFileSync(`perf-results/fs-bench-${stamp}.md`, toMarkdown(meta, results));
  };

  try {
    const page = context.pages()[0] ?? await context.newPage();
    page.setDefaultTimeout(0);
    page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));
    await page.goto(url);
    await page.waitForFunction(() => window.__fsb);

    if (options.subjects.includes("opfs")) {
      await page.evaluate(() => window.__fsb.openOpfs());
      const prepared = await page.evaluate((o) => window.__fsb.prepare("opfs", o), options);
      const onDisk = dirSizeMB(join(profile, "Default", "File System"));
      console.log(`fixtures OPFS: ${prepared.written} escritas em ${prepared.ms} ms · perfil/Default/File System = ${onDisk} MB em disco`);
      meta.notes.push(`OPFS em disco no perfil: ${onDisk} MB depois das fixtures.`);
    }

    if (options.subjects.includes("local")) {
      await dropFolder(page, resolve(localRoot));
      console.log(`pasta local solta na pagina: ${await page.evaluate(() => window.__fsb.subjects().join(", "))}`);
    }

    for (const [i, c] of cases.entries()) {
      const result = await page.evaluate((x) => window.__fsb.run(x), c);
      results.push(result);

      const ms = median((result.samples ?? []).map((s) => s.ms));
      const first = median((result.samples ?? []).map((s) => s.firstDataMs));
      const extra = result.status != "ok" ? ` ${result.note}` : ms != null ? ` mediana ${fmtMs(ms)} ms${first != null ? ` · 1o dado ${fmtMs(first)} ms` : ""}` : "";
      console.log(`[${i + 1}/${cases.length}] ${c.id}: ${result.status}${extra}`);
      writeReport(); // after every case, so an interrupted run still leaves a report
    }
  } finally {
    await context.close().catch(() => { });
    await server.close();
    if (!flag("keep")) rmSync(work, { recursive: true, force: true });
    else console.log(`mantido: ${work}`);
  }

  writeReport();
  console.log(`\nrelatorio: perf-results/fs-bench-${stamp}.md`);
}

main().then(() => process.exit(process.exitCode ?? 0), (error) => {
  console.error(error);
  process.exit(1);
});
