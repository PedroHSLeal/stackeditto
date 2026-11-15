// Generates clean/ (the proposed patch) and lab/ (same + globalThis.__PM_OFF toggle for in-process A/B) copies
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const base = "../../../../node_modules/prosemirror-model/dist/";
const rep = (src, a, b) => { if (!src.includes(a)) throw new Error("missing: " + a); return src.replace(a, b); };
const HELPER_ESM = `
// Cache of cumulative child end offsets for big fragments, so findIndex is O(log n) instead of O(n).
const BIG_FRAGMENT = 128;
function cumulativeEnds(content) {
    let ends = new Int32Array(content.length);
    for (let i = 0, pos = 0; i < content.length; i++)
        ends[i] = pos += content[i].nodeSize;
    return ends;
}
`;
const build = (lab) => {
  const off = lab ? "!globalThis.__PM_OFF && " : "";
  // ---- ESM
  let s = readFileSync(base + "index.js", "utf8");
  s = rep(s, "const found = { index: 0, offset: 0 };", HELPER_ESM + "const found = { index: 0, offset: 0 };");
  s = rep(s, "        this.size = size || 0;\n        if (size == null)", "        this.size = size || 0;\n        this.ends = null;\n        if (size == null)");
  s = rep(s, "        let copy = this.content.slice();\n        let size = this.size + node.nodeSize - current.nodeSize;\n        copy[index] = node;\n        return new Fragment(copy, size);",
`        let copy = this.content.slice();
        let delta = node.nodeSize - current.nodeSize;
        copy[index] = node;
        let result = new Fragment(copy, this.size + delta);
        if (${off}this.ends) {
            // Hand the offset table over to the new fragment (the old one rebuilds it on demand).
            let ends = this.ends;
            if (delta)
                for (let i = index; i < ends.length; i++)
                    ends[i] += delta;
            result.ends = ends;
            this.ends = null;
        }
        return result;`);
  s = rep(s, "            throw new RangeError(`Position ${pos} outside of fragment (${this})`);\n        for (let i = 0",
`            throw new RangeError(\`Position \${pos} outside of fragment (\${this})\`);
        if (${off}this.content.length >= BIG_FRAGMENT && this.size < 2147483647 && pos == pos) { // pos == pos: NaN keeps the original (throwing) path
            let ends = this.ends || (this.ends = cumulativeEnds(this.content));
            let lo = 0, hi = ends.length - 1; // first child whose end is >= pos
            while (lo < hi) {
                let mid = (lo + hi) >> 1;
                if (ends[mid] >= pos)
                    hi = mid;
                else
                    lo = mid + 1;
            }
            if (ends[lo] == pos)
                return retIndex(lo + 1, pos);
            return retIndex(lo, lo ? ends[lo - 1] : 0);
        }
        for (let i = 0`);
  const outdir = lab ? "lab/" : "clean/"; mkdirSync(outdir, { recursive: true });
  writeFileSync(outdir + "index.js", s);
  // ---- CJS (babel ES5 output)
  let c = readFileSync(base + "index.cjs", "utf8");
  c = rep(c, "var found = {", HELPER_ESM.replace(/\bconst\b/g, "var").replace(/\blet\b/g, "var") + "var found = {");
  c = rep(c, "    this.size = size || 0;\n    if (size == null)", "    this.size = size || 0;\n    this.ends = null;\n    if (size == null)");
  c = rep(c, "      var copy = this.content.slice();\n      var size = this.size + node.nodeSize - current.nodeSize;\n      copy[index] = node;\n      return new Fragment(copy, size);",
`      var copy = this.content.slice();
      var delta = node.nodeSize - current.nodeSize;
      copy[index] = node;
      var result = new Fragment(copy, this.size + delta);
      if (${off}this.ends) {
        // Hand the offset table over to the new fragment (the old one rebuilds it on demand).
        var ends = this.ends;
        if (delta) for (var i = index; i < ends.length; i++) ends[i] += delta;
        result.ends = ends;
        this.ends = null;
      }
      return result;`);
  c = rep(c, "outside of fragment (\").concat(this, \")\"));\n      for (var i = 0, curPos = 0;; i++) {",
`outside of fragment (").concat(this, ")"));
      if (${off}this.content.length >= BIG_FRAGMENT && this.size < 2147483647 && pos == pos) { // pos == pos: NaN keeps the original (throwing) path
        var ends = this.ends || (this.ends = cumulativeEnds(this.content));
        var lo = 0,
          hi = ends.length - 1; // first child whose end is >= pos
        while (lo < hi) {
          var mid = lo + hi >> 1;
          if (ends[mid] >= pos) hi = mid;else lo = mid + 1;
        }
        if (ends[lo] == pos) return retIndex(lo + 1, pos);
        return retIndex(lo, lo ? ends[lo - 1] : 0);
      }
      for (var i = 0, curPos = 0;; i++) {`);
  writeFileSync(outdir + "index.cjs", c);
};
build(false); build(true);
