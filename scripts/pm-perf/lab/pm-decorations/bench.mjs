// Micro-benchmark: original vs patched prosemirror-view decoration code, interleaved (ABAB...) in one process.
// usage: node bench.mjs [--cases 2000x50000,8000x400000,...] [--reps 5] [--libs o41,p41,o42,p42]
// Case = <top-level blocks>x<decorations>. Every third block is a code block that carries the decorations
// (one node decoration + inline "token" decorations, like prosemirror-highlight/shiki produce).
import { Schema } from "prosemirror-model";
import { Transform } from "prosemirror-transform";

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const cases = opt("--cases", "2000x50000,8000x50000,8000x400000,37000x400000").split(",").map((c) => c.split("x").map(Number));
const reps = +opt("--reps", 5);
const wanted = opt("--libs", "o41,p41,o42,p42").split(",");
const defs = {
  o41: ["orig 1.41.0", () => import("./builds/view-1.41-orig/dist/index.js")],
  p41: ["patched 1.41.0", () => import("./builds/view-1.41-patched/dist/index.js")],
  o42: ["orig 1.42.9", () => import("./builds/view-1.42-orig/dist/index.js")],
  p42: ["patched 1.42.9", () => import("./builds/view-1.42-patched/dist/index.js")],
};
const libs = [];
for (const k of wanted) libs.push({ key: k, name: defs[k][0], lib: await defs[k][1]() });

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    code_block: { content: "text*", group: "block", code: true },
    text: { group: "inline" },
  },
});

function buildCase(nBlocks, nDecos) {
  const codeBlocks = Math.floor(nBlocks / 3);
  const perBlock = Math.max(1, Math.round(nDecos / codeBlocks));
  const blocks = [];
  const plan = []; // [from, to, kind] kind 0 inline 1 node
  let pos = 0;
  for (let i = 0; i < nBlocks; i++) {
    if (i % 3 == 1) {
      const text = "const x = 1;".repeat(Math.ceil(perBlock / 2)).padEnd(perBlock * 5, " ");
      const node = schema.nodes.code_block.create(null, schema.text(text));
      plan.push([pos, pos + node.nodeSize, 1]);
      for (let t = 0; t < perBlock; t++) plan.push([pos + 1 + t * 5, pos + 1 + t * 5 + 4, 0]);
      blocks.push(node);
      pos += node.nodeSize;
    } else {
      const node = schema.nodes.paragraph.create(null, schema.text("Lorem ipsum dolor sit amet " + i));
      blocks.push(node);
      pos += node.nodeSize;
    }
  }
  return { doc: schema.nodes.doc.create(null, blocks), plan };
}
const mkDecos = (lib, plan) =>
  plan.map(([f, t, k]) => (k ? lib.Decoration.node(f, t, { style: "--bg:#fff" }) : lib.Decoration.inline(f, t, { style: "color:#111", class: "shiki" })));

function median(a) {
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1];
}
const fmt = (ms) => (ms >= 1000 ? (ms / 1000).toFixed(2) + " s" : ms.toFixed(1) + " ms");

const results = [];
for (const [nBlocks, nDecos] of cases) {
  const { doc, plan } = buildCase(nBlocks, nDecos);
  const real = plan.length;
  // edit: one character in the middle paragraph
  const tr = new Transform(doc);
  let midPos = 0;
  doc.forEach((n, off) => { if (n.type.name == "paragraph" && off < doc.content.size / 2) midPos = off + 2; });
  tr.insert(midPos, schema.text("x"));
  // 200 decorations to add (inline in paragraphs spread over the doc) and 200 to remove (copies of existing ones)
  const addPlan = [];
  let p = 0, k = 0;
  doc.forEach((n, off) => {
    if (n.type.name == "paragraph" && k++ % Math.max(1, Math.floor(nBlocks / 400)) == 0 && addPlan.length < 200) addPlan.push([off + 1, off + 6, 0]);
  });
  const per = {}; // key -> op -> samples
  const state = {};
  for (const l of libs) {
    per[l.key] = { create: [], map: [], add: [], remove: [], forChild: [] };
    state[l.key] = { set: null };
  }
  for (let r = 0; r < reps; r++) {
    for (const l of libs) {
      const S = per[l.key];
      const decos = mkDecos(l.lib, plan);
      let t0 = performance.now();
      const set = l.lib.DecorationSet.create(doc, decos);
      S.create.push(performance.now() - t0);

      t0 = performance.now();
      const mapped = set.map(tr.mapping, tr.doc);
      S.map.push(performance.now() - t0);

      const toAdd = mkDecos(l.lib, addPlan);
      t0 = performance.now();
      const added = mapped.add(tr.doc, toAdd);
      S.add.push(performance.now() - t0);

      // remove 200 existing decorations (found via find on a window, copies)
      const found = added.find(0, 1e9, (spec) => true).filter((_, i) => i % Math.max(1, Math.floor(real / 200)) == 0).slice(0, 200);
      t0 = performance.now();
      const removed = added.remove(found);
      S.remove.push(performance.now() - t0);

      t0 = performance.now();
      let off = 0, cnt = 0;
      tr.doc.forEach((child) => { if (set.forChild(off, child) !== l.lib.DecorationSet.empty) cnt++; off += child.nodeSize; });
      S.forChild.push(performance.now() - t0);
      state[l.key] = { cnt, removedN: removed.find().length, addedN: added.find().length };
    }
  }
  console.log(`\n### ${nBlocks} top-level blocks, ${real} decorations (${reps} samples each, median; interleaved)`);
  const base = {};
  const rows = [];
  for (const l of libs) {
    const m = {};
    for (const op of Object.keys(per[l.key])) m[op] = median(per[l.key][op]);
    rows.push([l.name, m, state[l.key]]);
  }
  console.log("| lib | create | map(1 char) | add(200) | remove(200) | forChild x n |");
  console.log("|---|---|---|---|---|---|");
  for (const [name, m] of rows) console.log(`| ${name} | ${fmt(m.create)} | ${fmt(m.map)} | ${fmt(m.add)} | ${fmt(m.remove)} | ${fmt(m.forChild)} |`);
  const sanity = new Set(rows.map(([, , s]) => JSON.stringify(s)));
  console.log(sanity.size == 1 ? `(sanity: all libs agree on counts ${[...sanity][0]})` : `!! libs disagree: ${[...sanity].join(" / ")}`);
  results.push({ nBlocks, real, rows: rows.map(([n, m]) => [n, m]) });
}
