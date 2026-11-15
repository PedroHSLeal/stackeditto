// Before/after the EditMap patch: same HTML output, and time.  node scripts/pm-perf/gfm-patch-check.mjs
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
const LOREM = "The quick brown fox jumps over the lazy dog while **strong words** and *emphasis* sit next to `inline code` and a [link](https://example.com/page) in the same sentence.";
const table = (i) => `| id | name | note |\n| :-- | :-: | --: |\n${Array.from({ length: 8 }, (_, r) => `| ${r} | row ${r} of ${i} | ${LOREM.slice(0, 40)} |`).join("\n")}\n\n`;
const md = (n) => Array.from({ length: n }, (_, i) => table(i)).join("") + "| a |\n|---|\n\nno table | here\n\n| x | y |\n|---|---|\n| only head row\n";
const t = (fn) => { const s = performance.now(); const r = fn(); return [Math.round(performance.now() - s), r]; };
const run = (n) => t(() => micromark(md(n), { extensions: [gfm()], htmlExtensions: [gfmHtml()] }));
const before = [100, 400, 800].map(run);
await import("./gfm-table-patch.mjs");
const after = [100, 400, 800, 3200].map(run);
console.log("tables | before ms | after ms | same html");
[100, 400, 800, 3200].forEach((n, i) => console.log(`${n} | ${before[i]?.[0] ?? "–"} | ${after[i][0]} | ${before[i] ? before[i][1] === after[i][1] : "–"}`));
