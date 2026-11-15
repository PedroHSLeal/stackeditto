// Interleaved A/B (original vs findIndex cache) of the per-keystroke model work. PM_LAB=1 + register.mjs
import { buildDoc, mkState, textblockNear } from "./common";
const g: any = globalThis;
const mb = Number(process.argv[2] ?? 8), ROUNDS = Number(process.argv[3] ?? 7), N = 300;
const doc = await buildDoc(mb);
console.log(`doc ${mb} MB: ${doc.childCount} top-level blocks, size ${doc.content.size}`);
const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];
const res: Record<string, { off: number[]; on: number[] }> = {};
for (const frac of [0.1, 0.5, 0.9]) {
  const pos = textblockNear(doc, frac);
  const r = (res[frac] = { off: [], on: [] });
  for (let round = 0; round < ROUNDS + 1; round++) for (const off of round % 2 ? [true, false] : [false, true]) {
    g.__PM_OFF = off;
    let st = mkState(doc); const s: number[] = [];
    for (let i = 0; i < N; i++) { const t = performance.now(); st = st.apply(st.tr.insertText("a", pos + i)); s.push(performance.now() - t); }
    if (round) (off ? r.off : r.on).push(med(s) * 1000);
  }
  console.log(`typing at ${frac}: original median-of-medians ${med(r.off).toFixed(0)} us (${r.off.length}x${N}) | patched ${med(r.on).toFixed(0)} us | speedup x${(med(r.off) / med(r.on)).toFixed(2)}`);
}
