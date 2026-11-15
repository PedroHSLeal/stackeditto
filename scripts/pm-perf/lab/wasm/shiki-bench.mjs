import { readFileSync } from "node:fs"; import { createHighlighter } from "shiki"; import { createJavaScriptRegexEngine } from "shiki/engine/javascript"; import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { unified } from "unified"; import remarkParse from "remark-parse"; import { HUGE } from "./common.mjs";
const langs = ["javascript","typescript","python","csharp","powershell","asm"];
const md = readFileSync(`${HUGE}/huge-file.md`, "utf8").replace(/\r\n/g, "\n");
const tree = unified().use(remarkParse).parse(md); const csharp = tree.children.filter(c=>c.type==="code").map(c=>c.value);
const samples = { csharp: csharp.join("\n\n").slice(0, 200_000), javascript: readFileSync("node_modules/unified/lib/index.js","utf8").repeat(8), typescript: readFileSync("node_modules/shiki/dist/core.d.mts","utf8").repeat(40), python: readFileSync("../parse-profile.ts","utf8") };
const mk = async (engine) => { const t = performance.now(); const h = await createHighlighter({ themes: ["github-light"], langs, engine }); return [h, performance.now() - t]; };
const med = (a) => a.sort((x,y)=>x-y)[a.length>>1];
const rows = []; const init = { onig: [], js: [] }; const hs = {};
for (let i = 0; i < 5; i++) { for (const k of ["onig","js"]) { const [h, ms] = await mk(k === "onig" ? createOnigurumaEngine(import("shiki/wasm")) : createJavaScriptRegexEngine()); init[k].push(ms); hs[k] = h; } }
console.log("cold first init ms onig/js:", init.onig[0].toFixed(0), init.js[0].toFixed(0)); console.log("init ms (median of 5, warm):", "onig", med(init.onig).toFixed(0), "js", med(init.js).toFixed(0));
for (const [lang, code] of Object.entries(samples)) {
  const r = { onig: [], js: [] }; let tokOnig, tokJs;
  for (let i = 0; i < 5; i++) for (const k of ["onig","js"]) { const t = performance.now(); const out = hs[k].codeToTokensBase(code, { lang, theme: "github-light" }); r[k].push(performance.now() - t); (k==="onig"?(tokOnig=out):(tokJs=out)); }
  const same = JSON.stringify(tokOnig.map(l=>l.map(t=>[t.content,t.color]))) === JSON.stringify(tokJs.map(l=>l.map(t=>[t.content,t.color])));
  console.log(lang, Math.round(code.length/1024)+"KB", tokOnig.length+" lines", "onig", med(r.onig).toFixed(0)+"ms", "js", med(r.js).toFixed(0)+"ms", "identical tokens:", same);
}
