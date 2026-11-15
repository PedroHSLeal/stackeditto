// node summ.mjs file.jsonl  -> medians per variant for numeric keys
import { readFileSync } from "node:fs";
const rows = readFileSync(process.argv[2], "utf8").trim().split("\n").map((l) => JSON.parse(l));
const by = {};
for (const r of rows) (by[r.variant] ??= []).push(r.r);
const med = (a) => { const s = a.filter((x) => typeof x == "number").sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const keys = process.argv.slice(3);
console.log(["variant", "n", ...keys].join("\t"));
for (const [v, list] of Object.entries(by)) console.log([v, list.length, ...keys.map((k) => med(list.map((r) => k.split(".").reduce((o, p) => o?.[p], r))))].join("\t"));
