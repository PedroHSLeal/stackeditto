import { buildDoc, mkState, textblockNear, plugins } from "./common";
import { history, undo } from "prosemirror-history";
import { EditorState } from "prosemirror-state";
const g: any = globalThis;
const doc = await buildDoc(Number(process.argv[2] ?? 8));
const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];
const pos = textblockNear(doc, 0.7);
for (const off of [true, false, true, false]) {
  g.__PM_OFF = off;
  let st = EditorState.create({ doc, plugins: [...plugins(), history()] }); const s: number[] = [];
  for (let i = 0; i < 300; i++) { const t = performance.now(); st = st.apply(st.tr.insertText("a", pos + i)); s.push(performance.now() - t); }
  let u = performance.now(); undo(st, (tr) => { st = st.apply(tr); }); u = performance.now() - u;
  console.log(off ? "orig   " : "patched", "with history(): apply median", (med(s) * 1000).toFixed(0), "us; undo", u.toFixed(2), "ms");
}
