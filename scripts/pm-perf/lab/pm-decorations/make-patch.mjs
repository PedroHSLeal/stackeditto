// Applies the pm-perf decoration patch to a prosemirror-view package directory (installed 1.41.0 or upstream 1.42.x).
// usage: node make-patch.mjs <srcPkgDir> <outPkgDir> [sweepMin=2048]
// Writes <outPkgDir>/dist/index.js, index.cjs and package.json. sweepMin=0 forces the sweep path (used by the equivalence test).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [src, out, sweepMinArg] = process.argv.slice(2);
const sweepMin = sweepMinArg ?? "2048";
const here = path.dirname(fileURLToPath(import.meta.url));
const helpers = fs.readFileSync(path.join(here, "view-helpers.js.txt"), "utf8").replace("__SWEEP_MIN__", sweepMin);

function once(text, find, repl, what) {
  if (find instanceof RegExp) {
    if (!find.test(text)) throw new Error("anchor not found: " + what);
    return text.replace(find, () => repl);
  }
  const idx = text.indexOf(find);
  if (idx < 0) throw new Error("anchor not found: " + what);
  if (text.indexOf(find, idx + 1) >= 0) throw new Error("anchor not unique: " + what);
  return text.replace(find, () => repl);
}

function patchEsm(t) {
  t = once(t, "function takeSpansForNode(spans, node, offset) {", helpers + "function takeSpansForNode(spans, node, offset) {", "helpers");
  t = once(t, `    let children = [], hasNulls = false;
    node.forEach((childNode, localStart) => {
        let found = takeSpansForNode(spans, childNode, localStart + offset);`,
`    let children = [], hasNulls = false;
    let taker = makeTaker(spans, node.childCount);
    node.forEach((childNode, localStart) => {
        let found = takeSpans(taker, spans, childNode, localStart + offset);`, "buildTree");
  t = once(t, /        let children, childIndex = 0;\n        doc\.forEach\(\(childNode, childOffset\) => \{[\s\S]*?            childIndex \+= 3;\n        \}\);\n/,
`        let children = addChildrenPatched(this, doc, decorations, offset), childIndex = children ? 1 : 0;\n`, "addInner");
  t = once(t, /        let children = this\.children, local = this\.local;\n        for \(let i = 0; i < children\.length; i \+= 3\) \{[\s\S]*?\n        if \(local\.length\)\n            for \(let i = 0, span; i < decorations\.length; i\+\+\)[\s\S]*?\n                \}\n        if \(children == this\.children && local == this\.local\)/,
`        let children = removeChildrenPatched(this, decorations, offset), local = removeLocalsPatched(this, decorations, offset);\n        if (children == this.children && local == this.local)`, "removeInner");
  t = once(t, /        let child, local;\n        for \(let i = 0; i < this\.children\.length; i \+= 3\)\n            if \(this\.children\[i\] >= offset\) \{\n                if \(this\.children\[i\] == offset\)\n                    child = this\.children\[i \+ 2\];\n                break;\n            \}\n/,
`        let child = childAt(this, offset), local;\n`, "forChild children");
  t = once(t, `        for (let i = 0; i < this.local.length; i++) {
            let dec = this.local[i];
            if (dec.from < end && dec.to > start && (dec.type instanceof InlineType)) {`,
`        let cands = inlineLocals(this);
        for (let i = 0; i < cands.length; i++) {
            let dec = cands[i];
            if (dec.from < end && dec.to > start && (dec.type instanceof InlineType)) {`, "forChild local");
  return t;
}

function patchCjs(t) {
  t = once(t, "function takeSpansForNode(spans, node, offset) {", helpers + "function takeSpansForNode(spans, node, offset) {", "helpers");
  t = once(t, `  var children = [],
    hasNulls = false;
  node.forEach(function (childNode, localStart) {
    var found = takeSpansForNode(spans, childNode, localStart + offset);`,
`  var children = [],
    hasNulls = false;
  var taker = makeTaker(spans, node.childCount);
  node.forEach(function (childNode, localStart) {
    var found = takeSpans(taker, spans, childNode, localStart + offset);`, "buildTree");
  t = once(t, /      var _this\d+ = this;\n      var children,\n        childIndex = 0;\n      doc\.forEach\(function \(childNode, childOffset\) \{[\s\S]*?        childIndex \+= 3;\n      \}\);\n/,
`      var children = addChildrenPatched(this, doc, decorations, offset),\n        childIndex = children ? 1 : 0;\n`, "addInner");
  t = once(t, /      var children = this\.children,\n        local = this\.local;\n      for \(var i = 0; i < children\.length; i \+= 3\) \{[\s\S]*?\n      if \(local\.length\) for \(var _i\d+ = 0, _span; _i\d+ < decorations\.length; _i\d+\+\+\) if \(_span = decorations\[_i\d+\]\) \{[\s\S]*?\n      \}\n      if \(children == this\.children && local == this\.local\)/,
`      var children = removeChildrenPatched(this, decorations, offset),\n        local = removeLocalsPatched(this, decorations, offset);\n      if (children == this.children && local == this.local)`, "removeInner");
  t = once(t, /      var child, local;\n      for \(var i = 0; i < this\.children\.length; i \+= 3\) if \(this\.children\[i\] >= offset\) \{\n        if \(this\.children\[i\] == offset\) child = this\.children\[i \+ 2\];\n        break;\n      \}\n/,
`      var child = childAt(this, offset),\n        local;\n`, "forChild children");
  t = once(t, /      for \(var (_i\d+) = 0; \1 < this\.local\.length; \1\+\+\) \{\n        var dec = this\.local\[\1\];/,
`      var cands = inlineLocals(this);\n      for (var _ic = 0; _ic < cands.length; _ic++) {\n        var dec = cands[_ic];`, "forChild local");
  return t;
}

fs.mkdirSync(path.join(out, "dist"), { recursive: true });
fs.writeFileSync(path.join(out, "dist/index.js"), patchEsm(fs.readFileSync(path.join(src, "dist/index.js"), "utf8")));
fs.writeFileSync(path.join(out, "dist/index.cjs"), patchCjs(fs.readFileSync(path.join(src, "dist/index.cjs"), "utf8")));
fs.copyFileSync(path.join(src, "package.json"), path.join(out, "package.json"));
console.log("patched ->", out, "sweepMin", sweepMin);
