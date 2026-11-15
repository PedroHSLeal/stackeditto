// Real-Shiki equivalence: patched prosemirror-highlight (installed in node_modules) driven incrementally vs a fresh full
// recomputation by the pristine plugin (./pristine) after every transaction. Mirrors src/services/prosemirror/plugins/shiki-code-block.ts.
// usage: node shiki-equiv.mjs [steps=300] [seed=3] [blocks=200]
import { Schema } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import { getSingletonHighlighter } from "shiki";
import * as pat from "prosemirror-highlight";
import { createParser as patParser } from "prosemirror-highlight/shiki";
import * as orig from "./pristine/dist/index.js";
import { createParser as origParser } from "./pristine/dist/shiki.js";

const steps = +(process.argv[2] ?? 300);
let seed = +(process.argv[3] ?? 3);
const nblocks = +(process.argv[4] ?? 200);
function rnd() { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const ri = (n) => Math.floor(rnd() * n);
const pick = (a) => a[ri(a.length)];

const baseLanguages = ["javascript", "typescript", "python", "csharp", "powershell", "asm"];
const ext = (l) => (baseLanguages.includes(l) ? l : "plaintext");
const highlighter = await getSingletonHighlighter({ themes: ["github-light"], langs: baseLanguages });
const mk = (hl, cp) => hl.createHighlightPlugin({ parser: cp(highlighter), nodeTypes: ["code_block"], languageExtractor: (n) => ext(n.attrs.language) });

const schema = new Schema({ nodes: {
  doc: { content: "block+" },
  paragraph: { content: "inline*", group: "block" },
  code_block: { content: "text*", group: "block", code: true, attrs: { language: { default: "" } } },
  text: { group: "inline" } } });
const TS = `export async function load<T>(url: string, retries = 3): Promise<T> {\n  for (let attempt = 0; attempt < retries; attempt++) {\n    const response = await fetch(url);\n    if (response.ok) return (await response.json()) as T;\n  }\n  throw new Error("giving up on " + url);\n}`;
const PY = `def fibonacci(limit: int) -> list[int]:\n    values = [0, 1]\n    while values[-1] + values[-2] < limit:\n        values.append(values[-1])\n    return values  # the sequence`;
const blocks = [];
for (let i = 0; i < nblocks; i++) {
  blocks.push(schema.nodes.paragraph.create(null, schema.text(`Paragraph ${i} before the code.`)));
  blocks.push(schema.nodes.code_block.create({ language: i % 2 ? "python" : "typescript" }, schema.text(i % 2 ? PY : TS)));
}
const doc0 = schema.nodes.doc.create(null, blocks);

const patPlugin = mk(pat, patParser);
let state = EditorState.create({ doc: doc0, plugins: [patPlugin] });
const norm = (st, plugin) => { const s = plugin.getState(st); return (s.decorations ? s.decorations.find() : []).map((d) => `${d.from}-${d.to}-${d.inline ? "i" : "n"}-${JSON.stringify(d.type.attrs)}`).sort().join("|"); };
const fresh = (d) => { const p = mk(orig, origParser); return norm(EditorState.create({ doc: d, plugins: [p] }), p); };

const codeBlocks = (d) => { const r = []; d.descendants((n, p) => { if (n.type.name === "code_block") r.push([n, p]); }); return r; };
let mism = 0, checks = 0; const kinds = {};
const langs = ["typescript", "python", "csharp", "foo", "", "asm", "javascript"];
for (let s = 0; s < steps; s++) {
  const tr = state.tr; const cbs = codeBlocks(state.doc); const kind = pick(["type", "type", "type", "split", "merge", "lang", "delete", "sel", "newcode", "multi", "refresh"]);
  kinds[kind] = (kinds[kind] || 0) + 1;
  try {
    if (kind === "type" && cbs.length) { const [n, p] = pick(cbs); const at = p + 1 + ri(n.content.size + 1); tr.insertText(pick(["x", " foo", "\n", "()", "const ", "  "]), at); }
    else if (kind === "split" && cbs.length) { const [n, p] = pick(cbs); tr.split(p + 1 + ri(n.content.size + 1)); }
    else if (kind === "merge") { const ps = []; state.doc.forEach((n, o, i) => { if (i > 0) ps.push(o); }); tr.join(pick(ps)); }
    else if (kind === "lang" && cbs.length) { const [n, p] = pick(cbs); tr.setNodeMarkup(p, null, { language: pick(langs) }); }
    else if (kind === "delete" && state.doc.childCount > 4) { const i = ri(state.doc.childCount); let o = 0; state.doc.forEach((n, off, idx) => { if (idx === i) o = off; }); tr.delete(o, o + state.doc.child(i).nodeSize); }
    else if (kind === "sel") { const p = 1 + ri(state.doc.content.size - 1); try { tr.setSelection(TextSelection.near(state.doc.resolve(p))); } catch {} }
    else if (kind === "newcode") { tr.insert(0, schema.nodes.code_block.create({ language: pick(langs) }, schema.text("let x = 1;\nprint(x)"))); }
    else if (kind === "multi" && cbs.length > 3) { for (let k = 0; k < 3; k++) { const [n, p] = pick(codeBlocks(tr.doc)); tr.insertText("y", tr.mapping.map(0) + 0 + p + 1); } }
    else if (kind === "refresh") { tr.setMeta("prosemirror-highlight-refresh", true); }
  } catch (e) { continue; }
  // the plugin's refresh meta key
  state = state.apply(tr);
  const a = norm(state, patPlugin), b = fresh(state.doc); checks++;
  if (a !== b) { mism++; if (mism < 3) { const A=a.split("|"),B=b.split("|"),sa=new Set(A),sb=new Set(B); console.log("MISMATCH step", s, kind, "onlyPatched", A.filter(x=>!sb.has(x)).slice(0,3), "onlyFresh", B.filter(x=>!sa.has(x)).slice(0,3), A.length, B.length); } }
}
console.log(`${mism ? "FAIL" : "ok  "} real shiki: ${steps} steps, ${checks} checks, ${mism} mismatches, doc blocks ${state.doc.childCount}`, JSON.stringify(kinds));
