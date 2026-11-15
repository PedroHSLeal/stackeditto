// Equivalence test: original prosemirror-view vs patched copies. Compares the *internal tree* (local arrays, children
// triplets, order of every local), the consumed-array null pattern, onRemove call order, find(), forChild() per child
// (recursively), and map/add/remove sequences.
// usage: node equiv.mjs [trials=400] [seed=1]
import { Schema } from "prosemirror-model";
import { Transform } from "prosemirror-transform";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const trials = +(process.argv[2] ?? 400);
let seed = +(process.argv[3] ?? 1);

const origEsm = await import("./orig-pv/dist/index.js");
const origCjs = require("./orig-pv/dist/index.cjs");
const subjects = [
  ["installed 1.41 patched esm", await import("prosemirror-view"), origEsm],
  ["installed 1.41 patched cjs", require("prosemirror-view"), origEsm],
  ["orig-cjs vs orig-esm (sanity)", origCjs, origEsm],
];

function rnd() {
  // mulberry32
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
    code_block: { content: "text*", group: "block", code: true },
    hr: { group: "block" },
    text: { group: "inline" },
    img: { group: "inline", inline: true },
  },
});

function randText() {
  let s = "";
  for (let i = 0, n = 1 + ri(12); i < n; i++) s += "abcdef ghij"[ri(11)];
  return s;
}
function randBlock(depth, wide) {
  const r = rnd();
  if (r < 0.5 || depth > 2) {
    const inl = [];
    for (let i = 0, n = ri(4); i < n; i++) inl.push(rnd() < 0.2 ? schema.nodes.img.create() : schema.text(randText()));
    // merge adjacent text nodes are fine (Fragment.from merges? use createAndFill-less create; adjacent texts get joined by Fragment)
    return schema.nodes.paragraph.create(null, inl);
  }
  if (r < 0.7) return schema.nodes.code_block.create(null, rnd() < 0.8 ? schema.text(randText() + randText()) : null);
  if (r < 0.8) return schema.nodes.hr.create();
  const kids = [];
  for (let i = 0, n = 1 + ri(wide ? 6 : 3); i < n; i++) kids.push(randBlock(depth + 1, wide));
  return schema.nodes.blockquote.create(null, kids);
}
function randDoc(top, wide) {
  const kids = [];
  for (let i = 0; i < top; i++) kids.push(randBlock(0, wide));
  return schema.nodes.doc.create(null, kids);
}

// collect interesting positions
function positions(doc) {
  const node = [], text = [], all = [];
  doc.descendants((n, pos) => {
    if (n.isText) return;
    node.push([pos, pos + n.nodeSize]);
    return true;
  });
  for (let p = 0; p <= doc.content.size; p++) all.push(p);
  doc.descendants((n, pos) => {
    if (n.inlineContent) for (let p = pos + 1; p <= pos + 1 + n.content.size; p++) text.push(p);
  });
  return { node, text, all };
}

let specId = 0;
function randDecos(doc, count, o) {
  const P = positions(doc);
  const out = [];
  if (rnd() < 0.5) {
    // dense mode: shrink the pool of positions so decorations collide (ties on from/to, duplicates, same-start nesting)
    const keep = (a) => a.filter(() => rnd() < 0.25).concat(a.slice(0, 2));
    P.text = keep(P.text); P.all = keep(P.all); P.node = P.node.filter(() => rnd() < 0.5);
    if (!P.node.length) P.node.push([0, doc.content.size]);
  }
  for (let i = 0; i < count; i++) {
    const r = rnd();
    const spec = { id: ++specId };
    if (r < 0.5 && P.text.length > 1) {
      const a = pick(P.text);
      const b = rnd() < 0.8 ? Math.min(a + 1 + ri(4), pick(P.text) > a ? a + 1 + ri(8) : a + 1) : pick(P.all);
      const from = Math.min(a, b), to = Math.max(a, b);
      out.push(o.Decoration.inline(from, to, { class: "c" + ri(3) }, spec));
    } else if (r < 0.65) {
      out.push(o.Decoration.inline(...[pick(P.all), pick(P.all)].sort((x, y) => x - y), { class: "x" }, spec));
    } else if (r < 0.85 && P.node.length) {
      const [f, t] = pick(P.node);
      out.push(o.Decoration.node(f, t, { class: "n" + ri(2) }, spec));
    } else if (r < 0.9) {
      out.push(o.Decoration.node(...[pick(P.all), pick(P.all)].sort((x, y) => x - y), { class: "bad" }, spec));
    } else {
      const p = pick(P.all);
      out.push(o.Decoration.widget(p, () => null, { id: spec.id, side: ri(3) - 1, key: "w" + spec.id }));
    }
  }
  if (rnd() < 0.5) {
    // sorted by from (the shiki / highlight case)
    out.sort((a, b) => a.from - b.from);
  }
  return out;
}

// ---------- dumping ----------
function dumpDeco(d) {
  const t = d.type;
  const kind = t.constructor.name; // InlineType / NodeType / WidgetType (names kept by esbuild? fall back below)
  return [d.from, d.to, d.inline ? "I" : d.widget ? "W" : "N", d.spec && (d.spec.id ?? d.spec.key), t.attrs ? JSON.stringify(t.attrs) : "", t.side ?? ""];
}
function dumpSet(set, seen = new Set()) {
  if (set.members) return { group: set.members.map((m) => dumpSet(m)) };
  return {
    local: set.local.map(dumpDeco),
    children: Array.from({ length: set.children.length / 3 }, (_, i) => [set.children[i * 3], set.children[i * 3 + 1], dumpSet(set.children[i * 3 + 2])]),
  };
}
function nullPattern(arr) {
  return arr.map((d) => (d ? d.spec && (d.spec.id ?? d.spec.key) : null));
}
function dumpForChildren(set, doc, depth, offset = 0, out = []) {
  // walk all children (to depth) like iterDeco does and dump forChild
  let off = 0;
  doc.forEach((child) => {
    const sub = set.forChild(offset + off, child);
    out.push([offset + off, dumpSet(sub)]);
    if (depth > 0 && !child.isLeaf) dumpForChildren(sub, child, depth - 1, 0, out);
    off += child.nodeSize;
  });
  return out;
}
const J = (x) => JSON.stringify(x);

let lenient = 0, failures = 0, checks = 0, bothThrew = 0;
// Runs fa/fb; the original may legitimately throw on malformed decorations (e.g. node deco at the end of a parent);
// then the patched build must throw the same kind of error and the trial is abandoned.
function both(fa, fb, label) {
  let ea, eb;
  try { fa(); } catch (e) { ea = e; }
  try { fb(); } catch (e) { eb = e; }
  checks++;
  // Expected divergence from the FragmentCursor backport (same as upstream 1.42.7+): original findIndex throws RangeError
  // for a node decoration positioned at/after the end of its parent; the cursor version just drops it.
  if (ea && !eb && ea instanceof RangeError) { lenient++; return false; }
  if (!!ea !== !!eb || (ea && ea.constructor !== eb.constructor)) {
    failures++;
    if (failures <= 5) console.log("THROW MISMATCH", label, ea && ea.message, "|", eb && eb.message);
    return false;
  }
  if (ea) { bothThrew++; return false; }
  return true;
}
function same(label, a, b, ctx) {
  checks++;
  const sa = J(a), sb = J(b);
  if (sa !== sb) {
    failures++;
    if (failures <= 5) console.log("MISMATCH", label, ctx ?? "", "\n  orig   :", sa.slice(0, 600), "\n  patched:", sb.slice(0, 600));
  }
}

function runTrial(P, O, docShape) {
  const doc = randDoc(docShape.top, docShape.wide);
  const count = docShape.decos;
  // Decorations are created per-library (different classes), from the same random choices: re-seed trick = generate with a
  // recorded plan. Simplest: generate with orig lib, then re-create equivalents with patched lib by field copy.
  const base = randDecos(doc, count, O);
  const clone = (lib, decos) =>
    decos.map((d) => {
      if (d.widget) return lib.Decoration.widget(d.from, d.type.toDOM, d.spec);
      if (d.inline) return lib.Decoration.inline(d.from, d.to, d.type.attrs, d.spec);
      return lib.Decoration.node(d.from, d.to, d.type.attrs, d.spec);
    });
  const aIn = clone(O, base), bIn = clone(P, base);
  const removedA = [], removedB = [];
  const optA = { onRemove: (s) => removedA.push(s.id ?? s.key) }, optB = { onRemove: (s) => removedB.push(s.id ?? s.key) };

  let A, B;
  if (!both(() => (A = O.DecorationSet.create(doc, aIn)), () => (B = P.DecorationSet.create(doc, bIn)), "create")) return;
  same("create tree", dumpSet(A), dumpSet(B), J(docShape));
  same("create consumed", nullPattern(aIn), nullPattern(bIn));
  same("find", A.find().map(dumpDeco), B.find().map(dumpDeco));
  const mid = doc.content.size >> 1;
  same("find range", A.find(mid - 5, mid + 5).map(dumpDeco), B.find(mid - 5, mid + 5).map(dumpDeco));
  same("forChild", dumpForChildren(A, doc, 3), dumpForChildren(B, doc, 3));
  same("locals", A.locals(doc).map(dumpDeco), B.locals(doc).map(dumpDeco));

  let curDoc = doc;
  for (let step = 0; step < 6; step++) {
    const r = rnd();
    if (r < 0.5) {
      // transform + map
      const tr = new Transform(curDoc);
      for (let k = 0, n = 1 + ri(3); k < n; k++) {
        try {
          const Pn = positions(tr.doc);
          const kind = ri(4);
          if (kind == 0 && Pn.text.length) tr.insertText("zz", pick(Pn.text));
          else if (kind == 1) {
            const a = pick(Pn.all), b = pick(Pn.all);
            tr.delete(Math.min(a, b), Math.max(a, b));
          } else if (kind == 2 && Pn.text.length) tr.split(pick(Pn.text));
          else if (kind == 3) {
            const [f, t] = pick(Pn.node);
            tr.replaceWith(f, t, randBlock(1, false));
          }
        } catch (e) { /* invalid edit, skip */ }
      }
      if (!tr.docs.length) continue;
      removedA.length = removedB.length = 0;
      if (!both(() => (A = A.map(tr.mapping, tr.doc, optA)), () => (B = B.map(tr.mapping, tr.doc, optB)), "map")) return;
      curDoc = tr.doc;
      same("map tree", dumpSet(A), dumpSet(B), "step " + step);
      same("map onRemove", removedA, removedB);
    } else if (r < 0.8) {
      const add = randDecos(curDoc, 1 + ri(Math.max(2, count >> 2)), O);
      const a2 = clone(O, add), b2 = clone(P, add);
      if (!both(() => (A = A.add(curDoc, a2)), () => (B = B.add(curDoc, b2)), "add")) return;
      same("add tree", dumpSet(A), dumpSet(B), "step " + step);
      same("add consumed", nullPattern(a2), nullPattern(b2));
    } else {
      // remove: a random subset of what is in the set (found via find, which copies) plus unrelated ones
      const found = A.find();
      const subset = found.filter(() => rnd() < 0.4);
      const extra = randDecos(curDoc, ri(4), O);
      const all = subset.concat(extra);
      for (let i = all.length - 1; i > 0; i--) { const j = ri(i + 1); [all[i], all[j]] = [all[j], all[i]]; }
      const a2 = clone(O, all), b2 = clone(P, all);
      if (!both(() => (A = A.remove(a2)), () => (B = B.remove(b2)), "remove")) return;
      same("remove tree", dumpSet(A), dumpSet(B), "step " + step);
      same("remove consumed", nullPattern(a2), nullPattern(b2));
    }
    same("forChild after op", dumpForChildren(A, curDoc, 2), dumpForChildren(B, curDoc, 2));
    same("find after op", A.find().map(dumpDeco), B.find().map(dumpDeco));
    same("eq self-consistent", A.eq(A) === B.eq(B), true);
  }
}

const shapes = [
  { top: 3, wide: false, decos: 8 },
  { top: 12, wide: true, decos: 40 },
  { top: 40, wide: true, decos: 200 },
  { top: 120, wide: false, decos: 600 },
];
for (const [name, P, O] of subjects) {
  failures = 0; checks = 0; bothThrew = 0;
  const t0 = performance.now();
  for (let i = 0; i < trials; i++) runTrial(P, O, shapes[i % shapes.length]);
  console.log(`${failures ? "FAIL" : "ok  "} ${name}: ${trials} trials, ${checks} comparisons, ${failures} mismatches, ${bothThrew} trials aborted by identical throws, ${lenient} lenient (${((performance.now() - t0) / 1000).toFixed(1)}s)`);
  if (failures) process.exitCode = 1;
}
