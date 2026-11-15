import { readFileSync } from "node:fs"; import * as m from "md4w"; import { HUGE } from "./common.mjs";
await m.init(new Uint8Array(readFileSync("node_modules/md4w/js/md4w-fast.wasm")));
const names = Object.fromEntries(Object.entries(m.NodeType).filter(([k,v])=>typeof v==="number").map(([k,v])=>[v,k]));
for (const f of ["huge-file.md","markdown-it-test-file.md"]) {
  const text = readFileSync(`${HUGE}/${f}`,"utf8").replace(/\r\n/g,"\n"); const tree = m.mdToJSON(text,{parseFlags:["DEFAULT","TABLES","TASKLISTS","STRIKETHROUGH"]}); const c={}; let strs=0;
  const w=(n)=>{ if(typeof n==="string"){strs++;return;} c[names[n.type]??n.type]=(c[names[n.type]??n.type]||0)+1; (n.children||[]).forEach(w); }; (tree.children ?? tree).forEach(w);
  console.log(f, JSON.stringify(c), "text strings:", strs);
}
