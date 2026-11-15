// profiles mdast -> PM compile separately. Usage: node --cpu-prof --cpu-prof-dir=... vite-node load-profile.ts <MB>
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { toProseMirror } from "@handlewithcare/remark-prosemirror/lib/mdast-util-to-prosemirror.js";
import { mdOfMB } from "./common";
import { mySchema } from "../../../../src/services/prosemirror/schema";
const md = mdOfMB(Number(process.argv[2] ?? 8));
const p = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter);
let t = performance.now();
const tree = p.runSync(p.parse(md));
console.log("parse+transform", Math.round(performance.now() - t), "ms");
// reuse the app's handlers via the processor: grab compiler
import { markdownToProseMirror } from "../../../../src/services/markdown/remark";
t = performance.now(); const d = await markdownToProseMirror(md); console.log("app total", Math.round(performance.now() - t), "ms", d.childCount);
