// Is remark's core superlinear in the tokenizer (micromark) or in tree building (mdast-util-from-markdown)?
import { readFileSync } from "node:fs";
import { parse, postprocess, preprocess } from "micromark";
import { fromMarkdown } from "mdast-util-from-markdown";
const fixture = readFileSync("md/huge-file.md", "utf8").replace(/\r\n/g, "\n") + "\n\n";
const LOREM = "The quick brown fox jumps over the lazy dog while **strong words** and *emphasis* sit next to `inline code`.";
const lists = Array.from({ length: 200 }, (_, i) => `${Array.from({ length: 10 }, (_, r) => `- item ${r} of ${i}: ${LOREM.slice(0, 60)}`).join("\n")}\n\n`).join("");
const t = (fn) => { global.gc?.(); const s = performance.now(); fn(); return Math.round(performance.now() - s); };
const tokens = (md) => postprocess(parse().document().write(preprocess()(md, undefined, true)));
console.log("corpus | MB | micromark events | fromMarkdown (events+tree)");
for (const [name, unit, sizes] of [["lists", lists, [0.5, 1, 2, 4]], ["fixture", fixture, [2, 4, 8, 16]]]) {
  for (const mb of sizes) {
    const md = unit.repeat(Math.max(1, Math.round(mb * 1048576 / unit.length)));
    console.log(`${name} | ${(md.length / 1048576).toFixed(1)} | ${t(() => tokens(md))} | ${t(() => fromMarkdown(md))}`);
  }
}
