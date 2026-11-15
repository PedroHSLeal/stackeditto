// Equivalence test for the prosemirror-highlight patch: original plugin vs patched plugin driven through the same random
// transactions (typing, deletes, split/join, code<->paragraph, wrapping, replace-whole-doc "undo", selection-only,
// async parser + refresh). After every transaction the set of decorations (from, to, attrs) must be identical.
// usage: node equiv-highlight.mjs [trials=150] [seed=7]
import { Schema } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import { Decoration } from "prosemirror-view";

const trials = +(process.argv[2] ?? 150);
let seed = +(process.argv[3] ?? 7);
function rnd() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (n) => Math.floor(rnd() * n);
const pick = (a) => a[ri(a.length)];

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    blockquote: { content: "block+", group: "block" },
    code_block: { content: "text*", group: "block", code: true, attrs: { language: { default: "js" } } },
    text: { group: "inline" },
  },
});
const words = ["let", "x", "=", "foo(bar)", "1;", "//", "end", "const", "ab", "z"];
const randText = () => Array.from({ length: 1 + ri(8) }, () => pick(words)).join(ri(5) ? " " : "  ");
function randBlock(depth) {
  const r = rnd();
  if (r < 0.4 || depth > 1) return schema.nodes.paragraph.create(null, schema.text(randText()));
  if (r < 0.8) return schema.nodes.code_block.create({ language: pick(["js", "js", "py", "skip"]) }, rnd() < 0.9 ? schema.text(randText() + "\n" + randText()) : null);
  const kids = Array.from({ length: 1 + ri(3) }, () => randBlock(depth + 1));
  return schema.nodes.blockquote.create(null, kids);
}
const randDoc = (n) => schema.nodes.doc.create(null, Array.from({ length: n }, () => randBlock(0)));

// deterministic sync parser; `variant` controls shape of output
function makeParser(asyncMode) {
  const memo = new Map();
  const sync = ({ content, language, pos, size }) => {
    if (language == "skip") return [];
    const out = [Decoration.node(pos, pos + size, { style: "--bg:" + language })];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(content))) out.push(Decoration.inline(pos + 1 + m.index, pos + 1 + m.index + m[0].length, { class: "t" + (m[0].length % 3) }));
    return out;
  };
  if (!asyncMode) return sync;
  // async: first call per (content, language) returns a Promise, later calls the array (like a lazily loaded grammar)
  return (o) => {
    const k = o.language + "|" + o.content;
    if (memo.has(k)) return sync(o);
    return new Promise((res) => setTimeout(() => { memo.set(k, 1); res(); }, 0));
  };
}

const orig13 = await import("./builds/hl-0.13-orig/dist/index.js");
const pat13 = await import("./builds/hl-0.13-patched/dist/index.js");
const orig16 = await import("./builds/hl-0.16-orig/dist/index.js");
const pat16 = await import("./builds/hl-0.16-patched/dist/index.js");
const full13 = await import("./builds/hl-0.13-fullpath/dist/index.js");
const full16 = await import("./builds/hl-0.16-fullpath/dist/index.js");

const norm = (state, plugin) => {
  const ps = plugin.getState(state);
  const set = ps.decorations;
  const list = set ? set.find().map((d) => `${d.from}-${d.to}-${d.inline ? "i" : "n"}-${JSON.stringify(d.type.attrs)}`) : [];
  return list.sort().join("|");
};

let failures = 0, checks = 0;
function same(label, a, b, ctx) {
  checks++;
  if (a !== b) {
    failures++;
    if (failures <= 4) console.log("MISMATCH", label, ctx, "\n  orig   :", a.slice(0, 300), "\n  patched:", b.slice(0, 300));
  }
}

async function trial(O, P, asyncMode) {
  const parserO = makeParser(asyncMode), parserP = makeParser(asyncMode);
  const opts = (parser) => ({ parser, nodeTypes: ["code_block"], languageExtractor: (n) => n.attrs.language });
  const pO = O.createHighlightPlugin(opts(parserO)), pP = P.createHighlightPlugin(opts(parserP));
  const doc = randDoc(3 + ri(30));
  let sO = EditorState.create({ doc, schema, plugins: [pO] }), sP = EditorState.create({ doc, schema, plugins: [pP] });
  const history = [doc];
  same("init", norm(sO, pO), norm(sP, pP), "init");
  const settle = async () => {
    if (!asyncMode) return;
    await new Promise((r) => setTimeout(r, 5));
    // what the plugin's view does once the promises resolve
    sO = sO.apply(sO.tr.setMeta("prosemirror-highlight-refresh", true));
    sP = sP.apply(sP.tr.setMeta("prosemirror-highlight-refresh", true));
    await new Promise((r) => setTimeout(r, 5));
    sO = sO.apply(sO.tr.setMeta("prosemirror-highlight-refresh", true));
    sP = sP.apply(sP.tr.setMeta("prosemirror-highlight-refresh", true));
  };
  await settle();
  same("init settled", norm(sO, pO), norm(sP, pP), "init-settled");
  for (let step = 0; step < 14; step++) {
    // build the same transaction for both states from a recipe computed on sO's doc
    const d = sO.doc;
    const size = d.content.size;
    const textPos = [], nodeSpans = [];
    d.descendants((n, p) => { if (n.inlineContent) for (let q = p + 1; q <= p + 1 + n.content.size; q++) textPos.push(q); if (!n.isText) nodeSpans.push([p, p + n.nodeSize, n]); });
    const kind = ri(11), txt = randText();
    const recipe = (tr) => {
      if (kind == 0 && textPos.length) tr.insertText("w ", textPos[(seed >>> 3) % textPos.length]);
      else if (kind == 1) { const a = (seed >>> 5) % (size + 1), b = (seed >>> 9) % (size + 1); tr.delete(Math.min(a, b), Math.max(a, b)); }
      else if (kind == 2 && textPos.length) tr.split(textPos[(seed >>> 4) % textPos.length]);
      else if (kind == 3) { const [f, , n] = nodeSpans[(seed >>> 6) % nodeSpans.length]; tr.setBlockType(f + 1, f + 1, n.type.name == "code_block" ? schema.nodes.paragraph : schema.nodes.code_block, n.type.name == "code_block" ? null : { language: "py" }); }
      else if (kind == 4) { const [f, t] = nodeSpans[(seed >>> 7) % nodeSpans.length]; tr.replaceWith(f, t, schema.nodes.code_block.create({ language: "js" }, schema.text(txt))); }
      else if (kind == 5) tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(size, 1))));
      else if (kind == 6) { const old = history[(seed >>> 8) % history.length]; tr.replaceWith(0, tr.doc.content.size, old.content); }
      else if (kind == 7) { const [f, , n] = nodeSpans[(seed >>> 6) % nodeSpans.length]; if (n.type.name == "code_block") tr.setNodeMarkup(f, null, { language: "py" }); }
      else if (kind == 8) { const [f, t] = nodeSpans[(seed >>> 7) % nodeSpans.length]; tr.insert(t, schema.nodes.code_block.create({ language: "js" }, schema.text(txt))); }
      else if (kind == 9) { tr.insertText("a", Math.max(1, Math.min(size - 1, (seed >>> 10) % (size + 1)))); }
      else if (textPos.length) tr.insertText("q", textPos[0]);
    };
    rnd(); // advance so the recipe's seed-derived values differ per step
    const mk = (s) => { const tr = s.tr; try { recipe(tr); } catch (e) { return s.tr; } return tr; };
    const trO = mk(sO), trP = mk(sP);
    if (trO.docChanged !== trP.docChanged || !trO.doc.eq(trP.doc)) continue; // invalid edit
    sO = sO.apply(trO); sP = sP.apply(trP);
    history.push(sO.doc);
    same("step" + kind, norm(sO, pO), norm(sP, pP), "kind " + kind + " step " + step);
    if (asyncMode && ri(3) == 0) { await settle(); same("settled" + kind, norm(sO, pO), norm(sP, pP), "settled"); }
  }
  await settle();
  same("final", norm(sO, pO), norm(sP, pP), "final");
}

for (const [name, O, P, asyncMode] of [
  ["0.13 sync", orig13, pat13, false],
  ["0.13 async", orig13, pat13, true],
  ["0.16 sync", orig16, pat16, false],
  ["0.16 async", orig16, pat16, true],
  ["0.13 sync, full-path only", orig13, full13, false],
  ["0.13 async, full-path only", orig13, full13, true],
  ["0.16 sync, full-path only", orig16, full16, false],
]) {
  failures = 0; checks = 0;
  for (let i = 0; i < trials; i++) await trial(O, P, asyncMode);
  console.log(`${failures ? "FAIL" : "ok  "} highlight ${name}: ${trials} trials, ${checks} comparisons, ${failures} mismatches`);
  if (failures) process.exitCode = 1;
}
