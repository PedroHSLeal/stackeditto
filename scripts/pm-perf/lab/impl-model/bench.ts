// One process = one variant (PM_PRISTINE set -> original). Prints median per-keystroke state.apply(insertText) us at 3 positions as JSON.
import { buildDoc, mkState, textblockNear } from "../pm-model/common";
const mb = Number(process.argv[2] ?? 8), N = 300;
const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];
const doc = await buildDoc(mb);
const out: any = { mb, blocks: doc.childCount };
for (const frac of [0.1, 0.5, 0.9]) {
  const pos = textblockNear(doc, frac); const runs: number[] = [];
  for (let r = 0; r < 4; r++) { let st = mkState(doc); const s: number[] = []; for (let i = 0; i < N; i++) { const t = performance.now(); st = st.apply(st.tr.insertText("a", pos + i)); s.push(performance.now() - t); } if (r) runs.push(med(s) * 1000); }
  out[frac] = Math.round(med(runs));
}
console.log("RESULT " + JSON.stringify(out));
