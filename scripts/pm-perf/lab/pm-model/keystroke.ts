import { buildDoc, mkState, textblockNear } from "./common";
const mb = Number(process.argv[2] ?? 8);
const t0 = performance.now();
const doc = await buildDoc(mb);
console.log("doc built", Math.round(performance.now() - t0), "ms; top-level blocks", doc.childCount, "size", doc.content.size);
const med = (a: number[]) => a.sort((x, y) => x - y)[a.length >> 1];
function bench(name: string, fn: () => void, n = 200) {
  for (let i = 0; i < 20; i++) fn();
  const s: number[] = [];
  for (let i = 0; i < n; i++) { const t = performance.now(); for (let k = 0; k < 10; k++) fn(); s.push((performance.now() - t) / 10); }
  console.log(name.padEnd(42), (med(s) * 1000).toFixed(1).padStart(9), "us  (n=" + n * 10 + ")");
}
let state = mkState(doc);
for (const frac of [0.1, 0.5, 0.9]) {
  const pos = textblockNear(doc, frac);
  console.log("--- position fraction", frac, "pos", pos);
  bench("content.findIndex(pos) top-level", () => (doc.content as any).findIndex(pos));
  let off = 0;
  bench("doc.resolve (uncached, fresh pos)", () => { doc.resolve(pos + (off++ % 5000 ? 0 : 0)); }, 100);
  bench("doc.resolve (cached)", () => doc.resolve(pos));
  bench("state.tr (new Transform)", () => { state.tr; });
  bench("tr.insertText", () => { state.tr.insertText("a", pos); });
  const tr0 = state.tr.insertText("a", pos);
  bench("tr.doc.replace (only step.apply)", () => { tr0.steps[0].apply(doc); });
  bench("state.apply(tr) (full)", () => { state.apply(state.tr.insertText("a", pos)); });
  bench("state.apply(tr) +selection", () => { state.apply(state.tr.insertText("a", pos).scrollIntoView()); });
  const f = (doc.content as any);
  bench("fragment.replaceChild", () => { f.replaceChild(5, f.child(5)); }, 100);
  const nn = doc.type.create(null, null);
  bench("array slice(content) copy only", () => { (f.content as any[]).slice(); });
  bench("Selection.map via tr.mapping", () => { state.selection.map(doc, tr0.mapping); });
  bench("doc.textBetween local", () => { doc.resolve(pos).parent.textBetween(0, doc.resolve(pos).parent.content.size, undefined, "￼"); });
}
