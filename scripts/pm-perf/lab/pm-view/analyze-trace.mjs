import { readFileSync } from "node:fs";
const ev = JSON.parse(readFileSync(process.argv[2], "utf8"));
const names = {};
for (const e of ev) names[e.name] = (names[e.name] ?? 0) + 1;
const kd = ev.filter((e) => e.name == "EventDispatch" && e.args?.data?.type == "keydown" && e.ph == "X");
console.log("keydowns", kd.length, "tid", kd.map((e) => e.tid));
const tid = kd[0].tid, pid = kd[0].pid;
const main = ev.filter((e) => e.pid == pid && e.tid == tid && e.ph == "X").sort((a, b) => a.ts - b.ts || b.dur - a.dur);
// per keydown: window = [keydown.ts, keydown.ts+450ms) ; find containing tasks
for (const k of kd.slice(1, 4)) {
  const t0 = k.ts, t1 = t0 + 450000;
  const inwin = main.filter((e) => e.ts >= t0 - 1000 && e.ts < t1);
  console.log(`\n=== key at ${(t0 / 1000).toFixed(0)}ms ===`);
  const tasks = inwin.filter((e) => e.name == "RunTask" && e.dur > 1000);
  for (const t of tasks) {
    const kids = inwin.filter((e) => e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e != t);
    // top-level children: not contained in other kid
    const top = kids.filter((a) => !kids.some((b) => b != a && b.ts <= a.ts && b.ts + b.dur >= a.ts + a.dur && (b.dur > a.dur || (b.dur == a.dur && b.ts < a.ts))) && a.dur > 200);
    console.log(`task ${(t.dur / 1000).toFixed(1)}ms @+${((t.ts - t0) / 1000).toFixed(0)}`);
    for (const c of top.slice(0, 14)) console.log("   ", c.name.padEnd(28), (c.dur / 1000).toFixed(1).padStart(7), c.args?.data?.type ?? c.args?.beginData?.frame ?? "");
  }
}
// aggregate self by name across window of keys 2-4
const agg = {};
const lo = kd[1].ts, hi = kd[3].ts + 600000;
const inw = main.filter((e) => e.ts >= lo && e.ts < hi);
for (const e of inw) agg[e.name] = (agg[e.name] ?? 0) + e.dur;
console.log("\nagg dur (inclusive) 3 keys, ms:");
for (const [n, d] of Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(n.padEnd(36), (d / 3000).toFixed(1));
// other threads (compositor, raster, GPU)
const thr = {};
for (const e of ev) if (e.ph == "X" && e.ts >= lo && e.ts < hi && e.tid != tid) { const key = e.pid + ":" + e.tid; thr[key] = (thr[key] ?? 0) + e.dur; }
console.log("other-thread busy (top)", Object.entries(thr).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => k + "=" + (v / 3000).toFixed(1)));
