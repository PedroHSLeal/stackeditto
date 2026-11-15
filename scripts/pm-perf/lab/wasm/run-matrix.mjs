// node run-matrix.mjs  -> results.jsonl ; each sample in its own process (peak RSS), variants interleaved per round
import { spawnSync } from "node:child_process"; import { appendFileSync } from "node:fs";
const fast = ["markdown-it", "ironmark-ast", "ironmark-html", "md4w-html", "markdown-wasm"];
const slow = ["remark", "mdrs-json", "comrak-ast"];
const plan = [[2, 3, [...slow, ...fast]], [8, 3, [...slow, ...fast]], [32, 1, ["remark", "mdrs-json", ...fast]], [32, 3, fast], [100, 1, fast]];
for (const [mb, reps, vs] of plan) for (let r = 0; r < reps; r++) for (const v of vs) {
  if (mb === 32 && reps === 3 && r === 0 && false) continue;
  const res = spawnSync("node", ["--max-old-space-size=12000", "child.mjs", v, String(mb)], { encoding: "utf8", timeout: 600000, maxBuffer: 1 << 26 });
  const line = (res.stdout || "").trim().split("\n").pop() || JSON.stringify({ variant: v, mb, error: "timeout/crash " + (res.stderr || "").slice(0, 120) });
  appendFileSync("results.jsonl", line + "\n"); console.log(line.slice(0, 200));
}
