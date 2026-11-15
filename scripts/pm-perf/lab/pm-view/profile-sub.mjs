import { readFileSync } from "node:fs";
const [file, root] = process.argv.slice(2);
const p = JSON.parse(readFileSync(file, "utf8"));
const byId = new Map(p.nodes.map((n) => [n.id, n])); const parent = new Map();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const nm = (n) => `${n.callFrame.functionName || "(anon)"}:${n.callFrame.lineNumber + 1}`;
const incl = new Map(), self = new Map(); let tot = 0;
p.samples.forEach((id, i) => {
  const d = p.timeDeltas[i] / 1000; const chain = []; for (let c = id; c != null; c = parent.get(c)) chain.push(byId.get(c));
  if (!chain.some((n) => n.callFrame.functionName == root)) return; tot += d;
  self.set(nm(chain[0]), (self.get(nm(chain[0])) ?? 0) + d);
  const seen = new Set(); for (const n of chain) { const k = nm(n); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) ?? 0) + d); } }
});
console.log("total under", root, tot.toFixed(0), "ms");
console.log("incl:"); for (const [k, v] of [...incl].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(v.toFixed(1).padStart(7), k);
console.log("self:"); for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(v.toFixed(1).padStart(7), k);
