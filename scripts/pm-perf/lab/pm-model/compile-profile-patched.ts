// Profile ONLY the mdast -> PM compile on a pre-parsed tree. node vite-node compile-profile.ts <MB> [profile.cpuprofile]
import { Session } from "node:inspector/promises";
import { writeFileSync } from "node:fs";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { toProseMirror } from "./remark-pm/mdast-util-to-prosemirror.js";
import { mdOfMB } from "./common";
import { handlers } from "./app-handlers";
import { mySchema } from "../../../../src/services/prosemirror/schema";
const mb = Number(process.argv[2] ?? 8);
const p = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter);
const tree = p.runSync(p.parse(mdOfMB(mb)));
let nodes = 0; (function w(n: any) { nodes++; n.children?.forEach(w); })(tree);
console.log("mdast nodes", nodes);
const run = () => { const t = performance.now(); const d = toProseMirror(tree as any, { schema: mySchema, handlers } as any); return [performance.now() - t, d] as const; };
run();
const out = process.argv[3];
let s: Session | undefined;
if (out) { s = new Session(); s.connect(); await s.post("Profiler.enable"); await s.post("Profiler.setSamplingInterval", { interval: 200 }); await s.post("Profiler.start"); }
const [ms, d] = run();
if (s) { const { profile } = await s.post("Profiler.stop"); writeFileSync(out, JSON.stringify(profile)); }
console.log("compile ms", Math.round(ms), "blocks", d.childCount);
