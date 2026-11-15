import { readFileSync } from "node:fs"; import { unified } from "unified"; import remarkParse from "remark-parse"; import gfm from "remark-gfm"; import fm from "remark-frontmatter";
import { loadMdrs, HUGE } from "./common.mjs"; import MarkdownIt from "markdown-it";
const m = await loadMdrs(); const p = unified().use(remarkParse).use(gfm).use(fm).freeze();
const strip = (n) => { if (Array.isArray(n)) return n.map(strip); if (n && typeof n === "object") { const o = {}; for (const k of Object.keys(n)) if (k !== "position" && n[k] !== null) o[k] = strip(n[k]); return o; } return n; };
const counts = (t, c = {}) => { c[t.type] = (c[t.type] || 0) + 1; for (const ch of t.children || []) counts(ch, c); return c; };
let diffs;
const firstDiff = (a, b, path = "") => { if (typeof a !== typeof b || (a === null) !== (b === null)) return path + ` ${JSON.stringify(a)?.slice(0,60)} != ${JSON.stringify(b)?.slice(0,60)}`;
  if (a && typeof a === "object") { if (Array.isArray(a) !== Array.isArray(b)) return path+" array/obj"; const ks = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of ks) { const r = firstDiff(a[k], b[k], path + "/" + k); if (r) return r; } return null; } return a === b ? null : path + ` ${JSON.stringify(a)?.slice(0,60)} != ${JSON.stringify(b)?.slice(0,60)}`; };
// count diffs per top-level child
for (const f of ["huge-file.md", "markdown-it-test-file.md"]) {
  const text = readFileSync(`${HUGE}/${f}`, "utf8").replace(/\r\n/g, "\n");
  const a = p.parse(text); const b = JSON.parse(m.mdastJson(text));
  const ca = counts(a), cb = counts(b); const types = [...new Set([...Object.keys(ca), ...Object.keys(cb)])].sort();
  console.log("\n##", f, "top-level children remark/mdrs:", a.children.length, b.children.length);
  console.log("| type | remark | markdown-rs |\n|---|---|---|"); for (const t of types) console.log(`| ${t} | ${ca[t]||0} | ${cb[t]||0} |`);
  const sa = strip(a), sb = strip(b); let same = 0, diff = 0, ex = [];
  const n = Math.min(sa.children.length, sb.children.length);
  for (let i = 0; i < n; i++) { const d = firstDiff(sa.children[i], sb.children[i]); if (d) { diff++; if (ex.length < 6) ex.push(`#${i} ${sa.children[i].type}: ${d}`); } else same++; }
  console.log("identical top-level children (position stripped):", same, "different:", diff); ex.forEach((e) => console.log("  ", e));
  console.log("deepEqual whole:", !firstDiff(sa, sb));
  // markdown-it
  const mdi = new MarkdownIt("commonmark").enable(["table","strikethrough"]); const toks = mdi.parse(text, {}); const tc = {}; for (const t of toks) tc[t.type] = (tc[t.type]||0)+1;
  console.log("markdown-it block tokens:", JSON.stringify(Object.fromEntries(Object.entries(tc).filter(([k])=>!/inline|close/.test(k)))));
}
// semantic check on custom HTML blocks / frontmatter
const probe = "---\ntitle: x\n---\n\n<my-block a=\"1\">\n\n# inner\n\n</my-block>\n\n<div>\ntext\n</div>\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n\nfoo[^1]\n\n[^1]: note\n\n~~s~~ https://x.com\n";
const a = strip(p.parse(probe)), b = strip(JSON.parse(m.mdastJson(probe)));
console.log("\nprobe diff:", firstDiff(a, b) ?? "none"); console.log("remark:", a.children.map(c=>c.type).join(",")); console.log("mdrs:  ", b.children.map(c=>c.type).join(","));
