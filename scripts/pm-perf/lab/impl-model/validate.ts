// Digest + oracle checks. Run twice (PM_PRISTINE=<dir> for original, unset for installed) and compare the DIGEST lines.
import { createHash } from "node:crypto";
import { buildDoc, mkState, mySchema } from "../pm-model/common";
import { Fragment, Slice, Node } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";
import { Transform, findWrapping } from "prosemirror-transform";
const S = mySchema;
let seed = 4242; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const ri = (n: number) => Math.floor(rnd() * n);
const h = createHash("sha256"); const dig = (s: string) => { h.update(s); if (s.startsWith("nothrow") || s.startsWith("throw")) console.log("BAD", s); };
let fails = 0; const fail = (m: string) => { fails++; console.log("FAIL", m); };
const em = S.marks.em.create(), st2 = S.marks.strong.create();
const para = (n: number, k = 0) => S.nodes.paragraph.create(null, Array.from({ length: n }, (_, i) => S.text("t" + k + "_" + i + "ab", i % 3 == 0 ? [em] : i % 3 == 1 ? [st2] : [])));
const paras = (n: number) => Array.from({ length: n }, (_, i) => para(1 + (i % 4), i));
function oracle(f: Fragment, pos: number) {
  if (pos == 0) return { index: 0, offset: 0 };
  if (pos == f.size) return { index: f.childCount, offset: f.size };
  let cur = 0;
  for (let i = 0; ; i++) { const end = cur + f.child(i).nodeSize; if (end >= pos) return end == pos ? { index: i + 1, offset: end } : { index: i, offset: cur }; cur = end; }
}
let queries = 0;
function check(f: Fragment, label: string, n = 150) {
  for (let k = 0; k < n; k++) {
    const p = k < 3 ? Math.min([0, f.size, 1][k], f.size) : ri(f.size + 1);
    const a = oracle(f, p), b = (f as any).findIndex(p);
    queries++; dig(`${label}:${p}:${b.index}:${b.offset}`);
    if (a!.index != b.index || a!.offset != b.offset) { fail(`${label} pos ${p} exp ${JSON.stringify(a)} got ${JSON.stringify({ ...b })}`); return; }
  }
  if (f.size < 20000) for (let p = 0; p <= f.size; p++) { const a = oracle(f, p), b = (f as any).findIndex(p); queries++; if (a!.index != b.index || a!.offset != b.offset) { fail(`${label} exh pos ${p}`); return; } }
}
const big = (n: number) => Fragment.fromArray(paras(n));
for (const n of [1, 2, 127, 128, 129, 130, 300, 1000]) {
  const f = big(n); check(f, "fromArray" + n);
  check(Fragment.from(paras(n)), "from-array" + n);
  check(Fragment.from(f), "from-frag" + n);
  check(f.append(big(n)), "append" + n);
  check(f.append(Fragment.empty), "append-empty" + n);
  check(Fragment.empty.append(f), "empty-append" + n);
  check(f.cut(0, f.size), "cutAll" + n);
  check(f.cut(f.size >> 2, f.size - 3), "cutMid" + n);
  check(f.cut(0, f.size >> 1), "cutHead" + n);
  check(f.addToStart(para(2)), "addStart" + n); check(f.addToEnd(para(2)), "addEnd" + n);
  check(f.replaceChild(n >> 1, para(7, 99)), "replaceChild" + n);
  check(f.replaceChild(0, para(1, 98)), "replaceChild0_" + n); check(f.replaceChild(n - 1, para(9, 97)), "replaceChildLast" + n);
  check(Fragment.fromJSON(S, f.toJSON()), "fromJSON" + n);
  check(Node.fromJSON(S, S.nodes.doc.create(null, f).toJSON()).content, "NodeFromJSON" + n);
  check(S.nodes.doc.create(null, f).copy(f).content, "copy" + n);
  check(S.nodes.doc.create(null, f).slice(2, f.size - 2).content, "slice" + n);
  check(new Slice(f, 0, 0).content, "Slice" + n);
  check(f.cutByIndex(1, n), "cutByIndex" + n);
  const d = S.nodes.doc.create(null, f);
  const ins = new Slice(big(140), 0, 0);
  check(d.replace(0, 0, ins).content, "replaceHead" + n);
  check(d.replace(f.size, f.size, ins).content, "replaceEnd" + n);
  check(d.replace(0, f.size, ins).content, "replaceAll" + n);
  try { check(d.replace(0, f.size, Slice.empty).content, "replaceEmpty" + n); } catch (e: any) { dig("rE" + e.constructor.name); }
  check(d.content.append(ins.content).cut(3), "chain" + n);
  const tr = new Transform(d); tr.delete(1, Math.min(d.content.size - 1, f.size >> 1)); check(tr.doc.content, "trDelete" + n);
  const tr2 = new Transform(d); tr2.insert(0, big(130)); check(tr2.doc.content, "trInsert" + n);
  const tr3 = new Transform(d); tr3.replaceWith(0, f.size, paras(200)); check(tr3.doc.content, "trReplaceWith" + n);
  dig(JSON.stringify(tr.doc.toJSON()) + JSON.stringify(tr3.doc.toJSON()));
}
console.log("construction-path queries", queries);
// immutability
{
  const base = S.nodes.doc.create(null, big(500)); const hist: Node[] = [base];
  check(base.content, "base-before", 300);
  let d = base;
  for (let i = 0; i < 400; i++) {
    const pos = ri(d.content.size - 2) + 1; const tr = new Transform(d);
    try { const $p = d.resolve(pos); if (i % 3 == 0) tr.insertText("q", TextSelection.near($p).from); else if (i % 3 == 1) tr.delete(Math.max(1, pos - 2), pos); else tr.split(TextSelection.near($p).from); } catch { continue; }
    d = tr.doc; hist.push(d);
    check(hist[ri(hist.length)].content, "old" + i, 5);
  }
  for (let i = 0; i < hist.length; i += 7) check(hist[i].content, "hist" + i, 40);
  check(base.content, "base-after", 300);
  dig(JSON.stringify(d.toJSON())); dig(String(hist.length));
  const b1 = base.content.replaceChild(3, para(2, 1)), b2 = base.content.replaceChild(4, para(5, 2)), b3 = base.content.replaceChild(3, para(9, 3));
  for (const [x, l] of [[b1, "b1"], [b2, "b2"], [b3, "b3"], [base.content, "b0"], [b1, "b1b"]] as const) check(x, l);
  let stale = 0, tot = 0; const chk = (fr: any) => { if (fr.ends) { tot++; let p = 0; fr.content.forEach((c: any, i: number) => { p += c.nodeSize; if (fr.ends[i] != p) stale++; }); if (fr.ends.length != fr.content.length) stale++; } };
  for (const x of hist) chk(x.content);
  console.log("ends tables", tot, "stale", stale); if (stale) fail("stale ends");
}
const doc = await buildDoc(Number(process.argv[2] ?? 0.5));
{
  check(doc.content, "realdoc", 500);
  let st = mkState(doc);
  for (let i = 0; i < 1200; i++) {
    const d = st.doc, max = d.content.size; const tr = st.tr; const kind = ri(7); const p = ri(max - 2) + 1;
    try {
      const $p = d.resolve(p), sel = TextSelection.near($p);
      if (kind <= 2) tr.insertText("xy"[ri(2)] + "z", sel.from);
      else if (kind == 3) { if (sel.from > 2) tr.delete(sel.from - 1, sel.from); }
      else if (kind == 4) tr.split(sel.from);
      else if (kind == 5) { const r = sel.$from.blockRange(); const w = r && findWrapping(r, S.nodes.blockquote); if (r && w) tr.wrap(r, w); }
      else tr.delete(p, Math.min(max, p + ri(50)));
    } catch (e: any) { dig("err" + e.constructor.name); continue; }
    if (tr.docChanged) st = st.apply(tr);
    dig(tr.steps.map(s => JSON.stringify(s.toJSON())).join("|") + ":" + st.doc.content.size + ":" + st.selection.from + "-" + st.selection.to);
    if (i % 5 == 0) dig(st.doc.resolve(ri(st.doc.content.size)).path.join(","));
  }
  dig(JSON.stringify(st.doc.toJSON()));
  check(st.doc.content, "realdoc-final", 500);
  check(doc.content, "realdoc-base-after", 500);
  let stale = 0, tot = 0; const chk = (fr: any) => { if (fr.ends) { tot++; let p = 0; fr.content.forEach((c: any, i: number) => { p += c.nodeSize; if (fr.ends[i] != p) stale++; }); } };
  chk(st.doc.content); st.doc.descendants((n: any) => { chk(n.content); }); if (stale) fail("stale real");
  console.log("real: ends tables", tot, "stale", stale, "final size", st.doc.content.size);
}
for (const bad of [-1, 1e12, NaN]) { try { dig("nothrow" + bad + JSON.stringify((big(500) as any).findIndex(bad))); } catch (e: any) { dig("throw" + bad + e.constructor.name); } }
console.log("queries", queries, "fails", fails, "ends-present:", (big(200) as any).ends !== undefined ? "patched" : "original");
console.log("DIGEST", h.digest("hex"));
