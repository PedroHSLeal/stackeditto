// who calls function X (inclusive time by caller chain, 3 levels)
import { readFileSync } from "node:fs";
const prof = JSON.parse(readFileSync(process.argv[2], "utf8")); const target = process.argv[3];
const byId = new Map(prof.nodes.map(n => [n.id, n])); const parent = new Map();
prof.nodes.forEach(n => (n.children || []).forEach(c => parent.set(c, n.id)));
const dt = prof.timeDeltas; const agg = new Map(); let total = 0;
const nm = n => `${n.callFrame.functionName || "(anon)"}@${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber + 1}`;
prof.samples.forEach((id, i) => { total += dt[i]; let n = byId.get(id), cur = id, hit = false; const chain = [];
  for (let c = id; c; c = parent.get(c)) { const nn = byId.get(c); if (nn.callFrame.functionName == target && !hit) { hit = true; chain.push(nm(nn)); } else if (hit && chain.length < 4) chain.push(nm(nn)); }
  if (hit) { const k = chain.join(" <- "); agg.set(k, (agg.get(k) || 0) + dt[i]); } });
console.log("total", (total / 1000).toFixed(0), "ms");
[...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, v]) => console.log((v / 1000).toFixed(0).padStart(6), "ms", k));
