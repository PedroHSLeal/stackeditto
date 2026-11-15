// Interleaved A/B of the mdast -> PM compile: original remark-prosemirror lib vs patched copy (+ equivalence)
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { toProseMirror as orig } from "./remark-pm-orig/mdast-util-to-prosemirror.js";
import { toProseMirror as patched } from "./remark-pm/mdast-util-to-prosemirror.js";
import { mdOfMB } from "./common";
import { handlers } from "./app-handlers";
import { mySchema } from "../../../../src/services/prosemirror/schema";
const mb = Number(process.argv[2] ?? 8), ROUNDS = Number(process.argv[3] ?? 5);
const p = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter);
const tree: any = p.runSync(p.parse(mdOfMB(mb)));
const opts: any = { schema: mySchema, handlers };
const t: Record<string, number[]> = { orig: [], patched: [] };
let dA: any, dB: any;
for (let r = 0; r < ROUNDS + 1; r++) for (const k of (r % 2 ? ["orig", "patched"] : ["patched", "orig"])) {
  global.gc?.(); const s = performance.now(); const d = (k == "orig" ? orig : patched)(tree, opts); const ms = performance.now() - s;
  if (r) t[k].push(ms); if (k == "orig") dA = d; else dB = d;
}
const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];
console.log(`mdast->PM ${mb} MB (${ROUNDS} rounds): original median ${med(t.orig).toFixed(0)} ms [${t.orig.map(x => x.toFixed(0))}] | patched ${med(t.patched).toFixed(0)} ms [${t.patched.map(x => x.toFixed(0))}] | x${(med(t.orig) / med(t.patched)).toFixed(2)}`);
console.log("equal:", dA.eq(dB), "JSON equal:", JSON.stringify(dA.toJSON()) == JSON.stringify(dB.toJSON()));
const c: number[] = []; for (let i = 0; i < 5; i++) { const s = performance.now(); dA.check(); c.push(performance.now() - s); } console.log("doc.check() on result: median", med(c).toFixed(0), "ms");
