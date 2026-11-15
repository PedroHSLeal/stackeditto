import { readFileSync } from "node:fs"; import { corpus } from "./common.mjs";
const { instance } = await WebAssembly.instantiate(readFileSync(new URL("./srch.wasm", import.meta.url)), {}); const x = instance.exports;
const med = (a) => [...a].sort((p, q) => p - q)[a.length >> 1];
const T = (f) => { const t = performance.now(); const r = f(); return [performance.now() - t, r]; };
const NEEDLE = "performance";
for (const mb of [8, 32, 100]) {
  const text = corpus(mb); const bytes = new TextEncoder().encode(text);
  const R = { decode: [], jsIndexOf: [], jsRegex: [], wasmCopy: [], wasmMemmem: [], jsWords: [], wasmWords: [] }; let c = {};
  for (let i = 0; i < 5; i++) {
    let [t, s] = T(() => new TextDecoder().decode(bytes)); R.decode.push(t);
    [t, c.a] = T(() => { let n = 0, p = 0; while ((p = s.indexOf(NEEDLE, p)) !== -1) { n++; p += NEEDLE.length; } return n; }); R.jsIndexOf.push(t);
    [t, c.r] = T(() => (s.match(/performance/g) || []).length); R.jsRegex.push(t);
    let ptr; [t] = T(() => { ptr = x.mdalloc(bytes.length); new Uint8Array(x.memory.buffer, ptr, bytes.length).set(bytes); }); R.wasmCopy.push(t);
    const nb = new TextEncoder().encode(NEEDLE); const np = x.mdalloc(nb.length); new Uint8Array(x.memory.buffer, np, nb.length).set(nb);
    [t, c.w] = T(() => x.count_matches(ptr, bytes.length, np, nb.length)); R.wasmMemmem.push(t);
    if (mb <= 32) { [t, c.jw] = T(() => { const m = new Map(); for (const w of s.toLowerCase().match(/[a-z0-9_]+/g)) m.set(w, (m.get(w) || 0) + 1); return m.size; }); R.jsWords.push(t);
      [t, c.ww] = T(() => x.word_counts(ptr, bytes.length)); R.wasmWords.push(t); }
    x.mdfree(ptr, bytes.length);
  }
  console.log(`\n${mb} MB (${(bytes.length/1048576).toFixed(1)} MiB bytes) matches js/regex/wasm:`, c.a, c.r, c.w, " unique words js/wasm:", c.jw, c.ww);
  for (const [k, v] of Object.entries(R)) if (v.length) console.log(" ", k.padEnd(11), med(v).toFixed(1), "ms (median of", v.length + ")");
}
