import { readFileSync } from "node:fs";
const dir = new URL("./lab/", import.meta.url);
export async function load(url, context, next) {
  const r = await next(url, context);
  const m = /node_modules\/prosemirror-model\/dist\/index\.(js|cjs)$/.exec(url);
  if (m && process.env.PM_LAB) {
    const src = readFileSync(new URL("index." + m[1], dir), "utf8");
    return { ...r, source: src, shortCircuit: true };
  }
  return r;
}
