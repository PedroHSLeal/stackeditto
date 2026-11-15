import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { readFileSync } from "node:fs";
import { toProseMirror as orig } from "./orig/lib/mdast-util-to-prosemirror.js";
import { toProseMirror as patched } from "@handlewithcare/remark-prosemirror/lib/mdast-util-to-prosemirror.js";
import { handlers } from "../pm-model/app-handlers";
import { mySchema } from "../../../../src/services/prosemirror/schema";
import { buildCorpus } from "../../../../playground/pm-perf/corpus";

const p = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter);
const trace = (log: string[], extra: any = {}) => {
  const h: any = {};
  for (const [k, f] of Object.entries(handlers as any)) h[k] = function (node: any, parent: any, state: any) {
    log.push(`${k}|${parent?.type}|${node.position?.start.offset}|defs=${[...state.definitionById.keys()]}|fn=${[...state.footnoteById.keys()]}|fo=${JSON.stringify(state.footnoteOrder)}`);
    return (f as any)(node, parent, state);
  };
  Object.assign(h, extra);
  return h;
};
let fails = 0;
function cmp(name: string, md: string, extra: any = {}) {
  const tree: any = p.runSync(p.parse(md));
  const la: string[] = [], lb: string[] = [];
  let a: any, b: any, ea = "", eb = "";
  try { a = orig(tree, { schema: mySchema, handlers: trace(la, extra) } as any); } catch (e: any) { ea = String(e.message).slice(0, 80); }
  try { b = patched(tree, { schema: mySchema, handlers: trace(lb, extra) } as any); } catch (e: any) { eb = String(e.message).slice(0, 80); }
  const ok = ea === eb && (!a || (a.eq(b) && JSON.stringify(a.toJSON()) === JSON.stringify(b.toJSON()))) && la.length === lb.length && la.every((x, i) => x === lb[i]);
  if (!ok) fails++;
  console.log(ok ? "OK  " : "FAIL", name, `calls=${la.length}`, ea ? `err=${ea}` : "");
}
const files: [string, string][] = [["huge", "md/huge-file.md"], ["mdit", "md/markdown-it-test-file.md"]];
for (const [n, f] of files) cmp(n, readFileSync(f, "utf8").replace(/\r\n/g, "\n"));
for (const k of ["fixture", "prose", "fenced", "tables", "lists", "html", "giant-block"] as const) for (const mb of [0.05, 0.3]) cmp(`${k}-${mb}`, await buildCorpus(k, mb).text());
const edge: Record<string, string> = {
  footnotes: "Text[^1] and again[^1] and [^2] missing[^9].\n\n[^1]: First *note* here.\n[^2]: Second\n\n    with para.\n",
  footnoteDefBefore: "[^a]: early def\n\nUse[^a].\n",
  imgRef: "![alt][x] and ![b][missing] and ![c][X]\n\n[x]: http://e.com/i.png \"T\"\n[X]: http://dup.com/dup.png\n",
  htmlAttr: '<my-tag a="1" b=\'two\' c>\ncontent\n</my-tag>\n\ntext\n\n<other-tag>\nx\n</other-tag>\n\n<div class="x">hi</div>\n',
  htmlNone: "<x>\nplain\n</x>\n\n<!-- comment -->\n\n<br>\n",
  nestedBq: "> a\n> > b\n> > > c\n> > > > d\n>\n> - li\n>   > in\n",
  olStart: "3. a\n4. b\n\n1. x\n\n0. z\n\n- u\n  1. n\n  2. m\n",
  empty: "", whitespace: "\n\n  \n",
  frontmatter: "---\ntitle: x\n---\n\n# H\n\ntext\n",
  hardbreak: "line one  \nline two\\nline three\n",
  marks: "**b *i `c` ~~d~~* [l **b** ](http://x \"t\")** ~~del [lk](u)~~ *e **s** f*\n",
  table1: "| a |\n| - |\n", table2: "| a | b |\n| - | - |\n| 1 | **2** |\n| 3 | 4 |\n",
  thematic: "a\n\n---\n\n***\n\nb\n",
  def: "[d]: http://x\n\n[d]: http://y\n\nsee [d]\n",
};
for (const [n, md] of Object.entries(edge)) cmp(n, md);
// handlers returning arrays / null / undefined
cmp("ret-array", "a\n\nb\n\n- x\n- y\n", { thematicBreak: () => [mySchema.nodes.paragraph.create(), mySchema.nodes.paragraph.create()] });
cmp("ret-null", "a\n\n---\n\nb\n", { thematicBreak: () => null });
cmp("ret-undef", "a\n\n---\n\nb\n", { thematicBreak: () => undefined });
cmp("ret-array-empty", "a\n\n---\n\nb\n", { thematicBreak: () => [] });
cmp("unknown-type", "a\n\n$$\nx\n$$\n", { paragraph: undefined });
console.log(fails ? `FAILURES: ${fails}` : "ALL EQUIVALENT");
