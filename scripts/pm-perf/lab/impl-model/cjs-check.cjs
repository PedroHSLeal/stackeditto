// differential test of clean/index.cjs (patched) vs orig/index.cjs on a synthetic schema
const O = require(process.env.PM_PRISTINE + "/dist/index.cjs"), P = require("../../../../node_modules/prosemirror-model/dist/index.cjs");
const mk = (M) => { const schema = new M.Schema({ nodes: { doc: { content: "block+" }, p: { group: "block", content: "inline*" }, text: { group: "inline" } }, marks: { em: {} } });
  return schema; };
let seed = 1; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const build = (M, schema, n) => { seed = 7; return schema.node("doc", null, Array.from({ length: n }, (_, i) => schema.node("p", null, i % 3 ? [schema.text("x".repeat(1 + (i * 7) % 5))] : []))); };
let bad = 0, calls = 0;
for (const n of [3, 127, 128, 129, 1000, 5000]) {
  const a = build(O, mk(O), n), b = build(P, mk(P), n);
  // random replaceChild chains + findIndex
  let fa = a.content, fb = b.content; seed = 99;
  for (let i = 0; i < 400; i++) {
    const idx = Math.floor(rnd() * fa.childCount), sa = fa.child(idx).type.schema, sb = fb.child(idx).type.schema;
    const txt = "y".repeat(1 + Math.floor(rnd() * 4));
    fa = fa.replaceChild(idx, sa.node("p", null, [sa.text(txt)])); fb = fb.replaceChild(idx, sb.node("p", null, [sb.text(txt)]));
    for (let k = 0; k < 3; k++) { const pos = Math.floor(rnd() * (fa.size + 1)); const x = fa.findIndex(pos), y = fb.findIndex(pos); calls++; if (x.index != y.index || x.offset != y.offset) bad++; }
  }
  if (fa.size != fb.size) bad++;
}
for (const bad_ of [-1, NaN, 1e9]) for (const F of [P]) { try { b = build(P, mk(P), 500); b.content.findIndex(bad_); console.log("no throw", bad_); } catch (e) { if (!(e instanceof RangeError)) console.log("other", e); } }
console.log("cjs differential: calls", calls, "mismatches", bad);
