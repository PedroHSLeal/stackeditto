// Interleaved A/B of the two parse fixes, both versions loaded side by side in one process,
// so machine speed drift hits both equally.   node --expose-gc scripts/pm-perf/deps-ab.mjs
// Needs node_modules/.ab-{old,new}/node_modules/{mdast-util-from-markdown,micromark-extension-gfm-table}
// (extracted with npm pack). Mirrors remark-parse + remark-gfm + remark-frontmatter.
import { readFileSync } from "node:fs";
import { combineExtensions } from "micromark-util-combine-extensions";
import { gfmAutolinkLiteral } from "micromark-extension-gfm-autolink-literal";
import { gfmFootnote } from "micromark-extension-gfm-footnote";
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough";
import { gfmTaskListItem } from "micromark-extension-gfm-task-list-item";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { frontmatter } from "micromark-extension-frontmatter";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";

const load = async (side) => ({
  fromMarkdown: (await import(`../../node_modules/.ab-${side}/node_modules/mdast-util-from-markdown/index.js`)).fromMarkdown,
  gfmTable: (await import(`../../node_modules/.ab-${side}/node_modules/micromark-extension-gfm-table/index.js`)).gfmTable,
});
const sides = { old: await load("old"), new: await load("new") };
const parse = ({ fromMarkdown, gfmTable }, md) => fromMarkdown(md, {
  extensions: [combineExtensions([gfmAutolinkLiteral(), gfmFootnote(), gfmStrikethrough(), gfmTable(), gfmTaskListItem()]), frontmatter()],
  mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown()],
});

const fixture = readFileSync("md/huge-file.md", "utf8").replace(/\r\n/g, "\n") + "\n\n";
const LOREM = "The quick brown fox jumps over the lazy dog while **strong words** and *emphasis* sit next to `inline code` and a [link](https://example.com/page) in the same sentence.";
const units = {
  fixture,
  tables: Array.from({ length: 200 }, (_, i) => `| id | name | note |\n| --- | --- | --- |\n${Array.from({ length: 8 }, (_, r) => `| ${r} | row ${r} of ${i} | ${LOREM.slice(0, 40)} |`).join("\n")}\n\n`).join(""),
  lists: Array.from({ length: 200 }, (_, i) => `${Array.from({ length: 10 }, (_, r) => `- item ${r} of ${i}: ${LOREM.slice(0, 60)}`).join("\n")}\n\n`).join(""),
  prose: Array.from({ length: 200 }, (_, i) => (i % 20 == 0 ? `## Section ${i}\n\n${LOREM}\n\n` : `${LOREM} ${LOREM}\n\n`)).join(""),
};
const corpus = (kind, mb) => units[kind].repeat(Math.max(1, Math.round((mb * 1048576) / Buffer.byteLength(units[kind]))));
const time = (fn) => { global.gc?.(); const s = performance.now(); const r = fn(); return [performance.now() - s, r]; };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const strip = (n) => JSON.stringify(n, (k, v) => (k == "position" ? undefined : v));

const plan = [["tables", 0.25, 5], ["tables", 0.5, 3], ["lists", 1, 5], ["lists", 2, 5], ["prose", 2, 5], ["fixture", 2, 5], ["fixture", 8, 3], ["fixture", 16, 3]];
console.log("corpus | MB | rounds | old median ms | new median ms | speed-up | same mdast | old samples | new samples");
for (const [kind, mb, rounds] of plan) {
  const md = corpus(kind, mb);
  const t = { old: [], new: [] };
  let same = null;
  for (let i = 0; i < rounds; i++) {
    for (const side of i % 2 ? ["new", "old"] : ["old", "new"]) {
      const [ms, tree] = time(() => parse(sides[side], md));
      t[side].push(ms);
      if (i == 0) same = same == null ? strip(tree) : same === strip(tree);
    }
  }
  const o = median(t.old), n = median(t.new);
  console.log(`${kind} | ${mb} | ${rounds} | ${Math.round(o)} | ${Math.round(n)} | ${(o / n).toFixed(1)}× | ${same} | ${t.old.map(Math.round).join(",")} | ${t.new.map(Math.round).join(",")}`);
}
