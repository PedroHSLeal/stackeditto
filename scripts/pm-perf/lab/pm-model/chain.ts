// realistic typing chain: every keystroke produces a NEW doc (resolve cache cold)
import { buildDoc, mkState, textblockNear } from "./common";
import { Fragment } from "prosemirror-model";
const mb = Number(process.argv[2] ?? 8);
const doc = await buildDoc(mb);
console.log("top-level blocks", doc.childCount, "size", doc.content.size);
const med = (a: number[]) => a.sort((x, y) => x - y)[a.length >> 1];
const proto: any = Fragment.prototype;
const orig = proto.findIndex;
let cnt = 0, scanned = 0;
for (const frac of [0.1, 0.5, 0.9]) {
  const pos = textblockNear(doc, frac);
  let state = mkState(doc);
  // counts
  cnt = 0; proto.findIndex = function (p: number) { if (this.content.length > 1000) cnt++; return orig.call(this, p); };
  let st = state; for (let i = 0; i < 5; i++) st = st.apply(st.tr.insertText("a", pos + i));
  proto.findIndex = orig;
  const per = cnt / 5;
  const s: number[] = [];
  st = state;
  for (let i = 0; i < 400; i++) { const t = performance.now(); st = st.apply(st.tr.insertText("a", pos + i)); s.push(performance.now() - t); }
  console.log(`frac ${frac}: apply per keystroke median ${(med(s) * 1000).toFixed(0)} us (p90 ${(s.sort((a, b) => a - b)[360] * 1000).toFixed(0)}), big findIndex calls/keystroke ${per}`);
  // pieces
  const bt = (name: string, fn: () => void) => { const r: number[] = []; for (let i = 0; i < 300; i++) { const t = performance.now(); fn(); r.push(performance.now() - t); } console.log("   ", name.padEnd(30), (med(r) * 1000).toFixed(0), "us"); };
  let d = st.doc; let k = 0;
  bt("fresh doc.resolve(pos)", () => { d = st.apply(st.tr.insertText("b", pos + 400 + k++)).doc; d.resolve(pos + 400 + k); });
  bt("tr.insertText only", () => { st.tr.insertText("c", pos + 3); });
  const f: any = st.doc.content;
  bt("content.findIndex", () => f.findIndex(pos + 7));
  bt("content.slice()", () => f.content.slice());
}
