// Equivalence: patched (ON) vs original (OFF) findIndex/replaceChild on random edit sequences.  Run with PM_LAB=1 + register.mjs
import { buildDoc, mkState, mySchema } from "./common";
import { Fragment, Slice } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";
import { liftTarget, findWrapping } from "prosemirror-transform";
const g: any = globalThis;
const doc = await buildDoc(Number(process.argv[2] ?? 0.5));
console.log("blocks", doc.childCount);
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const ri = (n: number) => Math.floor(rnd() * n);

// 1) differential findIndex on fragments of many shapes
const frags: Fragment[] = [doc.content];
doc.descendants((n, _p) => { if (n.childCount > 100 || (frags.length < 300 && n.childCount > 1 && rnd() < 0.01)) frags.push(n.content); return frags.length < 400; });
{
  const S = mySchema, em = S.marks.em.create(), st2 = S.marks.strong.create();
  const para = (n: number) => S.nodes.paragraph.create(null, Array.from({ length: n }, (_, i) => S.text("t" + i + "ab", i % 3 == 0 ? [em] : i % 3 == 1 ? [st2] : [])));
  const li = (n: number) => S.nodes.bullet_list.create(null, Array.from({ length: n }, (_, i) => S.nodes.list_item.create(null, para(1 + (i % 4)))));
  const d2 = S.nodes.doc.create(null, [para(400), li(500), li(130), li(127), li(128), li(129), li(3)]);
  frags.push(d2.content); d2.descendants((n: any) => { if (n.childCount > 100) frags.push(n.content); });
}
let checks = 0;
for (const f of frags) for (let k = 0; k < 400; k++) {
  const p = k < 3 ? [0, f.size, 1][k] : ri(f.size + 1);
  g.__PM_OFF = true; const a = { ...(f as any).findIndex(p) };
  g.__PM_OFF = false; const b = { ...(f as any).findIndex(p) };
  if (a.index != b.index || a.offset != b.offset) { console.log("MISMATCH", p, a, b); process.exit(1); }
  checks++;
}
for (const bad of [-1, 1e12, NaN]) for (const off of [true, false]) { g.__PM_OFF = off; try { (doc.content as any).findIndex(bad); console.log("no throw", bad, off); } catch (e: any) { if (!(e instanceof RangeError)) console.log("other error", e); } }
console.log("findIndex differential ok:", checks, "checks over", frags.length, "fragments (", frags.filter(f => f.childCount >= 128).length, "big )");

// 2) random edit sequences
function run(off: boolean, ops: number, s0: number) {
  g.__PM_OFF = off; seed = s0;
  let st = mkState(doc);
  const log: string[] = [];
  for (let i = 0; i < ops; i++) {
    const d = st.doc; const max = d.content.size;
    let tr = st.tr; const kind = ri(7); let p = ri(max - 2) + 1;
    try {
      const $p = d.resolve(p);
      if (kind <= 2) { const sel = TextSelection.near($p); tr.insertText("xy"[ri(2)] + "z", sel.from); }
      else if (kind == 3) { const sel = TextSelection.near($p); if (sel.from > 2) tr.delete(sel.from - 1, sel.from); }
      else if (kind == 4) { const sel = TextSelection.near($p); tr.split(sel.from); }
      else if (kind == 5) { const $f = TextSelection.near($p).$from; const r = $f.blockRange(); const w = r && findWrapping(r, mySchema.nodes.blockquote); if (r && w) tr.wrap(r, w); }
      else { const q = Math.min(max, p + ri(50)); tr.delete(p, q); }
    } catch (e: any) { log.push("err:" + e.constructor.name); continue; }
    if (tr.docChanged) st = st.apply(tr); log.push(tr.steps.length + ":" + st.doc.content.size);
    if (i % 5 == 0) st.doc.resolve(ri(st.doc.content.size));
  }
  return { st, log };
}
const OPS = 1500;
const A = run(true, OPS, 777), B = run(false, OPS, 777);
console.log("random edits: log equal =", A.log.join() == B.log.join(), "| doc.eq =", A.st.doc.eq(B.st.doc), "| size", A.st.doc.content.size, B.st.doc.content.size, "| JSON equal =", JSON.stringify(A.st.doc.toJSON()) == JSON.stringify(B.st.doc.toJSON()), "| sel equal =", A.st.selection.eq(B.st.selection));
// final: base doc must be intact and queries on base still agree after steals
g.__PM_OFF = false; const f: any = doc.content; let bad = 0; for (let k = 0; k < 2000; k++) { const p = ri(f.size + 1); g.__PM_OFF = true; const a = { ...f.findIndex(p) }; g.__PM_OFF = false; const b = { ...f.findIndex(p) }; if (a.index != b.index || a.offset != b.offset) bad++; }
console.log("base doc fragment after steals mismatches:", bad);
// every fragment on the final doc: verify ends vs recomputed
let stale = 0, tot = 0; const chk = (fr: any) => { if (fr.ends) { tot++; let pos = 0; fr.content.forEach((c: any, i: number) => { pos += c.nodeSize; if (fr.ends[i] != pos) stale++; }); } };
for (const st of [A.st, B.st]) { chk(st.doc.content); st.doc.descendants((n: any) => { chk(n.content); }); }
console.log("ends tables checked", tot, "stale", stale);
