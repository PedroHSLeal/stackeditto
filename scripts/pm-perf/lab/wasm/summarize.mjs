import { readFileSync } from "node:fs";
const rows = readFileSync(process.argv[2] ?? "results.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
const g = {}; for (const r of rows) (g[`${r.variant}|${r.mb}`] ??= []).push(r);
const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
console.log("| variante | MB | n | parse ms (mediana) | JSON.parse ms | total até AST JS ms | init ms | pico RSS MB | erro |\n|---|---|---|---|---|---|---|---|---|");
for (const [k, v] of Object.entries(g).sort((a, b) => a[1][0].mb - b[1][0].mb || a[0].localeCompare(b[0]))) {
  const f = (x) => { const a = v.map((r) => r[x]).filter((y) => y != null); return a.length ? Math.round(med(a)) : ""; };
  console.log(`| ${v[0].variant} | ${v[0].mb} | ${v.length} | ${f("parseMs")} | ${f("jsonParseMs")} | ${f("totalMs")} | ${f("initMs")} | ${f("peakRssMB")} | ${v.find((r) => r.error)?.error?.slice(0, 40) ?? ""} |`);
}
