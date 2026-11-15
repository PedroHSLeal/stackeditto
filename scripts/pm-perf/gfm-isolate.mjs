// Which GFM extension makes table parsing slow, and how does it scale?  node scripts/pm-perf/gfm-isolate.mjs
import { fromMarkdown } from "mdast-util-from-markdown";
import { micromark } from "micromark";
import { gfmTable } from "micromark-extension-gfm-table";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import { gfmAutolinkLiteral } from "micromark-extension-gfm-autolink-literal";
import { gfmAutolinkLiteralFromMarkdown } from "mdast-util-gfm-autolink-literal";
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough";
import { gfmStrikethroughFromMarkdown } from "mdast-util-gfm-strikethrough";
import { gfmFootnote } from "micromark-extension-gfm-footnote";
import { gfmFootnoteFromMarkdown } from "mdast-util-gfm-footnote";

const LOREM = "The quick brown fox jumps over the lazy dog while **strong words** and *emphasis* sit next to `inline code` and a [link](https://example.com/page) in the same sentence.";
const table = (i) => `| id | name | note |\n| --- | --- | --- |\n${Array.from({ length: 8 }, (_, r) => `| ${r} | row ${r} of ${i} | ${LOREM.slice(0, 40)} |`).join("\n")}\n\n`;
const text = (n) => Array.from({ length: n }, (_, i) => table(i)).join("");
const t = (fn) => { const s = performance.now(); fn(); return Math.round(performance.now() - s); };

const variants = {
  core: [[], []],
  table: [[gfmTable()], [gfmTableFromMarkdown()]],
  autolink: [[gfmAutolinkLiteral()], [gfmAutolinkLiteralFromMarkdown()]],
  strike: [[gfmStrikethrough()], [gfmStrikethroughFromMarkdown()]],
  footnote: [[gfmFootnote()], [gfmFootnoteFromMarkdown()]],
};

console.log("tables | KB | " + Object.keys(variants).map((v) => `${v} mdast`).join(" | ") + " | table micromark→html (no mdast)");
for (const n of [100, 200, 400, 800]) {
  const md = text(n);
  const cells = Object.values(variants).map(([ext, mext]) => t(() => fromMarkdown(md, { extensions: ext, mdastExtensions: mext })));
  const html = t(() => micromark(md, { extensions: [gfmTable()] }));
  console.log(`${n} | ${Math.round(md.length / 1024)} | ${cells.join(" | ")} | ${html}`);
}
