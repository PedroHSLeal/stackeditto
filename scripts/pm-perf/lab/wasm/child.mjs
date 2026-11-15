// node [--max-old-space-size=N] child.mjs <variant> <mb>   -> prints one JSON line (ms + peak RSS)
import { corpus, loadMdrs } from "./common.mjs";
const [variant, mbArg] = process.argv.slice(2); const mb = Number(mbArg);
const text = corpus(mb); const bytes = Buffer.byteLength(text);
const out = { variant, mb, bytes: +(bytes/1048576).toFixed(2) };
const T = async (f) => { const t = performance.now(); const r = await f(); return [performance.now() - t, r]; };
const base = process.memoryUsage().rss;
try {
switch (variant) {
  case "remark": {
    const { unified } = await import("unified"); const remarkParse = (await import("remark-parse")).default;
    const gfm = (await import("remark-gfm")).default, fm = (await import("remark-frontmatter")).default;
    const p = unified().use(remarkParse).use(gfm).use(fm).freeze();
    const [ms, tree] = await T(() => p.parse(text)); out.parseMs = ms; out.totalMs = ms; out.nodes = count(tree); break; }
  case "markdown-it": {
    const MarkdownIt = (await import("markdown-it")).default; const md = new MarkdownIt("commonmark").enable(["table","strikethrough"]);
    const [ms, toks] = await T(() => md.parse(text, {})); out.parseMs = ms; out.totalMs = ms; out.nodes = toks.length; break; }
  case "mdrs-parse": { const m = await loadMdrs(); out.initMs = m.initMs; const [ms] = await T(() => m.parseOnly(text)); out.parseMs = ms; out.totalMs = ms; break; }
  case "mdrs-json": {
    const m = await loadMdrs(); out.initMs = m.initMs;
    const [ms, json] = await T(() => m.mdastJson(text)); out.parseMs = ms; out.jsonMB = +(json.length/1048576).toFixed(1);
    const [ms2, tree] = await T(() => JSON.parse(json)); out.jsonParseMs = ms2; out.totalMs = ms + ms2; out.nodes = count(tree); break; }
  case "mdrs-html": { const m = await loadMdrs(); const [ms, h] = await T(() => m.html(text)); out.parseMs = ms; out.totalMs = ms; out.htmlMB = +(h.length/1048576).toFixed(1); break; }
  case "ironmark-ast": {
    const i = (await import("ironmark")).default; const [ms0] = await T(async () => { if (i.ready) await i.ready; }); out.initMs = ms0;
    const [ms, ast] = await T(() => i.parse(text).ast()); out.parseMs = ms; out.totalMs = ms; out.nodes = count(ast); break; }
  case "ironmark-html": {
    const i = (await import("ironmark")).default; if (i.ready) await i.ready;
    const [ms, h] = await T(() => i.parse(text).html()); out.parseMs = ms; out.totalMs = ms; break; }
  case "comrak-ast": {
    const t0 = performance.now(); const c = await import("comrak"); out.initMs = performance.now() - t0;
    const [ms, ast] = await T(() => c.parseMarkdown(text, { extension: { table: true, tasklist: true, strikethrough: true, autolink: true, frontMatterDelimiter: "---" } })); out.parseMs = ms; out.totalMs = ms; out.nodes = ast.nodes?.length; break; }
  case "comrak-html": {
    const c = await import("comrak"); const [ms] = await T(() => c.markdownToHTML(text, { extension: { table: true, tasklist: true, strikethrough: true } })); out.parseMs = ms; out.totalMs = ms; break; }
  case "md4w-json": {
    const t0 = performance.now(); const m = await import("md4w"); await m.init(new Uint8Array((await import("node:fs")).readFileSync("node_modules/md4w/js/md4w-fast.wasm"))); out.initMs = performance.now() - t0;
    const [ms, tree] = await T(() => m.mdToJSON(text, { parseFlags: ["DEFAULT","TABLES","TASKLISTS","STRIKETHROUGH"] })); out.parseMs = ms; out.totalMs = ms; out.nodes = count({children: tree}); break; }
  case "md4w-html": {
    const t0 = performance.now(); const m = await import("md4w"); await m.init(new Uint8Array((await import("node:fs")).readFileSync(process.env.MD4W_WASM ?? "node_modules/md4w/js/md4w-fast.wasm"))); out.initMs = performance.now() - t0;
    const [ms] = await T(() => m.mdToHtml(text)); out.parseMs = ms; out.totalMs = ms; break; }
  case "markdown-wasm": {
    const t0 = performance.now(); const m = await import("markdown-wasm"); await m.ready; out.initMs = performance.now() - t0;
    const [ms] = await T(() => m.parse(text)); out.parseMs = ms; out.totalMs = ms; break; }
}
} catch (e) { out.error = String(e).slice(0, 200); }
out.peakRssMB = Math.round(process.resourceUsage().maxRSS / 1024);
console.log(JSON.stringify(out));
function count(t){ let n=0; const s=[t]; while(s.length){const x=s.pop(); n++; const ch = Array.isArray(x)? x : x.children ?? (x && typeof x==='object' ? Object.values(x).filter(v=>typeof v==='object'&&v):[]); if(Array.isArray(x)) {for(const c of x) s.push(c)} else if(x.children) for(const c of x.children) s.push(c);} return n; }
