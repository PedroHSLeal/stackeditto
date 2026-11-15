import { loadMdrs, fixture } from "./common.mjs";
const m = await loadMdrs(); const f = fixture();
const blocks = f.split(/\n\n+/);
const cls = (b) => /^\s*[-*] /.test(b) ? "list" : /^    /.test(b) ? "indented" : /^#/.test(b) ? "heading" : /^>/.test(b) ? "quote" : /^</.test(b) ? "html" : /^!?\[/.test(b)?"linkstart":"para";
const g = {}; for (const b of blocks) (g[cls(b)] ??= []).push(b);
const rep = (s, mb) => s.repeat(Math.ceil(mb*1048576/s.length));
for (const [k,v] of Object.entries(g)) { const u = v.join("\n\n")+"\n\n"; const r=[]; for (const mb of [0.5,2]) { const s=rep(u,mb); const t=performance.now(); m.parseOnly(s); r.push(Math.round(performance.now()-t)); } console.log(k, v.length, Math.round(u.length/1024)+"KB", "0.5MB/2MB ms:", r.join(" / ")); }
