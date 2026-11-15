import { readFileSync } from "node:fs";
const ev = JSON.parse(readFileSync(process.argv[2], "utf8"));
const idx = Number(process.argv[3] ?? 2), min = Number(process.argv[4] ?? 1000);
const kd = ev.filter((e) => e.name == "EventDispatch" && e.args?.data?.type == "keydown" && e.ph == "X");
const k = kd[idx]; const main = ev.filter((e) => e.pid == k.pid && e.tid == k.tid && e.ph == "X").sort((a, b) => a.ts - b.ts || b.dur - a.dur);
const win = main.filter((e) => e.ts >= k.ts - 2000 && e.ts < k.ts + 160000 && e.dur >= min);
const stack = [];
for (const e of win) {
  while (stack.length && stack[stack.length - 1].ts + stack[stack.length - 1].dur <= e.ts) stack.pop();
  const d = e.args?.data; const info = d ? (d.type ?? d.functionName ?? d.url ?? d.stackTrace?.[0]?.functionName ?? "") : "";
  console.log("  ".repeat(stack.length) + e.name, (e.dur / 1000).toFixed(1), `@+${((e.ts - k.ts) / 1000).toFixed(1)}`, info, d?.stackTrace ? "STACK:" + d.stackTrace.slice(0, 3).map((s) => s.functionName + ":" + s.lineNumber).join("<") : "");
  stack.push(e);
}
