// Swaps prosemirror-model's dist for the pristine npm copy when PM_PRISTINE=<dir of unpacked package> is set.
import { readFileSync } from "node:fs";
export async function load(url, context, next) {
  const r = await next(url, context);
  const m = /node_modules\/prosemirror-model\/dist\/index\.(js|cjs)$/.exec(url);
  if (m && process.env.PM_PRISTINE) {
    return { ...r, source: readFileSync(process.env.PM_PRISTINE + "/dist/index." + m[1], "utf8"), shortCircuit: true };
  }
  return r;
}
