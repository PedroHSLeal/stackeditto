import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
export const HUGE = process.env.MD_DIR ?? fileURLToPath(new URL("../../../../md", import.meta.url));
export const fixture = () => readFileSync(`${HUGE}/huge-file.md`, "utf8").replace(/\r\n/g, "\n") + "\n\n";
export const corpus = (mb) => { const f = fixture(); return f.repeat(Math.max(1, Math.round((mb * 1024 * 1024) / Buffer.byteLength(f)))); };
export async function loadMdrs() {
  const t = performance.now();
  const bytes = readFileSync(new URL("./mdrs.wasm", import.meta.url));
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const x = instance.exports;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const put = (s) => { const b = enc.encode(s); const p = x.mdalloc(b.length); new Uint8Array(x.memory.buffer, p, b.length).set(b); return [p, b.length]; };
  const take = (p) => { const n = x.out_len(); const s = dec.decode(new Uint8Array(x.memory.buffer, p, n)); x.mdfree(p, n); return s; };
  return {
    initMs: performance.now() - t,
    parseOnly: (s) => { const [p, n] = put(s); const r = x.parse_only(p, n); x.mdfree(p, n); return r; },
    mdastJson: (s) => { const [p, n] = put(s); const o = x.to_mdast_json(p, n); x.mdfree(p, n); return take(o); },
    html: (s) => { const [p, n] = put(s); const o = x.to_html(p, n); x.mdfree(p, n); return take(o); },
  };
}
