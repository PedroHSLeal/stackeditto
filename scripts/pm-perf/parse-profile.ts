// Where does markdown → ProseMirror time go, and does it grow faster than the input?
//
//   npx vite-node scripts/pm-perf/parse-profile.ts [maxMB]
//
// Runs in Node (no browser): the parse pipeline is pure JS. Stages, all on the same text:
//   micromark+mdast (core)   remark-parse alone
//   micromark+mdast (+gfm+fm) remark-parse + remark-gfm + remark-frontmatter, i.e. the app's parse()
//   mdast → PM               remark-prosemirror compile (the app's handlers)
//   app total                markdownToProseMirror, the function the app calls
//   markdown-it tokens       markdown-it with tables + strikethrough (no tree)
//   prosemirror-markdown     markdown-it → ProseMirror with its own default schema
import { readFileSync, writeFileSync } from "node:fs";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import MarkdownIt from "markdown-it";
import { defaultMarkdownParser } from "prosemirror-markdown";

import { markdownToProseMirror } from "../../src/services/markdown/remark";

const maxMB = Number(process.argv[2] ?? 32);
const fixture = readFileSync("md/huge-file.md", "utf8").replace(/\r\n/g, "\n") + "\n\n";
const LOREM = "The quick brown fox jumps over the lazy dog while **strong words** and *emphasis* sit next to `inline code` and a [link](https://example.com/page) in the same sentence.";

const units: Record<string, string> = {
  fixture,
  tables: Array.from({ length: 200 }, (_, i) => `| id | name | note |\n| --- | --- | --- |\n${Array.from({ length: 8 }, (_, r) => `| ${r} | row ${r} of ${i} | ${LOREM.slice(0, 40)} |`).join("\n")}\n\n`).join(""),
  lists: Array.from({ length: 200 }, (_, i) => `${Array.from({ length: 10 }, (_, r) => `- item ${r} of ${i}: ${LOREM.slice(0, 60)}`).join("\n")}\n\n`).join(""),
  prose: Array.from({ length: 200 }, (_, i) => (i % 20 == 0 ? `## Section ${i}\n\n${LOREM}\n\n` : `${LOREM} ${LOREM}\n\n`)).join(""),
};

const corpus = (kind: string, mb: number) => units[kind].repeat(Math.max(1, Math.round((mb * 1024 * 1024) / Buffer.byteLength(units[kind]))));

const core = unified().use(remarkParse).freeze();
const full = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter).freeze();
const mdIt = new MarkdownIt("commonmark").enable(["table", "strikethrough"]);

const LIMIT_MS = 240_000;
const time = async (fn: () => unknown) => {
  global.gc?.();
  const t = performance.now();
  await fn();
  return Math.round(performance.now() - t);
};

const rows: string[] = [];
const results: unknown[] = [];
const sizes = [0.6, 2, 8, 32, 100].filter((s) => s <= maxMB);
const plan: [string, number][] = [...sizes.map((s) => ["fixture", s] as [string, number]), ["tables", 0.5], ["tables", 2], ["lists", 2], ["prose", 2]];

const lastOf = new Map<string, { mb: number; gfmMs: number }>();

for (const [kind, mb] of plan) {
  // Skip a size whose quadratic extrapolation from the previous size of the same corpus would blow the limit.
  const last = lastOf.get(kind);
  if (last && last.gfmMs * (mb / last.mb) ** 2 > LIMIT_MS) {
    rows.push(`| ${kind} | ${mb} | skipped: ~${Math.round(last.gfmMs * (mb / last.mb) ** 2 / 1000)} s extrapolated | | | | | | |`);
    console.log(rows.at(-1));
    continue;
  }

  const text = corpus(kind, mb);
  const r: Record<string, number | string | null> = { kind, mb: +(Buffer.byteLength(text) / 1048576).toFixed(1) };
  let tree: any;

  r.coreMs = await time(() => core.parse(text));
  r.gfmMs = await time(() => { tree = full.parse(text); });
  r.mdastNodes = (() => { let n = 0; const walk = (x: any) => { n++; x.children?.forEach(walk); }; walk(tree); return n; })();

  // app total re-parses, so compile ≈ total − parse
  r.appTotalMs = r.gfmMs > LIMIT_MS ? null : await time(() => markdownToProseMirror(text));
  r.compileMs = r.appTotalMs == null ? null : Math.max(0, (r.appTotalMs as number) - (r.gfmMs as number));
  tree = null;

  r.markdownItMs = await time(() => mdIt.parse(text, {}));
  r.pmMarkdownMs = await time(() => defaultMarkdownParser.parse(text));

  lastOf.set(kind, { mb, gfmMs: r.gfmMs as number });
  results.push(r);
  rows.push(`| ${kind} | ${r.mb} | ${r.coreMs} | ${r.gfmMs} | ${r.compileMs ?? "–"} | ${r.appTotalMs ?? "–"} | ${r.markdownItMs} | ${r.pmMarkdownMs} | ${r.mdastNodes} |`);
  console.log(rows.at(-1));
}

const header = "| corpus | MB | remark core | remark+gfm+fm (parse) | mdast→PM (total − parse) | app total | markdown-it tokens | prosemirror-markdown | mdast nodes |\n|---|---|---|---|---|---|---|---|---|";
writeFileSync("perf-results/parse-profile.md", `# Parse profile (Node ${process.version})\n\nAll times in ms.\n\n${header}\n${rows.join("\n")}\n`);
writeFileSync("perf-results/parse-profile.json", JSON.stringify(results, null, 1));
