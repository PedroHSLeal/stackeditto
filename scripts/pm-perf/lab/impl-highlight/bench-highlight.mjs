// Benchmark of the prosemirror-highlight plugin: original vs patched (plus patched prosemirror-view), interleaved.
// The parser is a synthetic regex tokenizer (node decoration + one inline decoration per token, like shiki's createParser) so
// the numbers isolate decoration/plugin cost from Shiki tokenization.
// usage: node bench-highlight.mjs [--cases 2000,8000] [--reps 3] [--tokens 32] [--libs o13,p13,o16,p16]
import { Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const cases = opt("--cases", "2000,8000").split(",").map(Number);
const reps = +opt("--reps", 3);
const tokens = +opt("--tokens", 32);
const wanted = opt("--libs", "o13,p13,o13v,p13v").split(",");

const defs = {
  o13: ["orig hl + installed view", "./pristine/dist/index.js", "prosemirror-view"],
  p13: ["patched hl + installed view", "../../../../node_modules/prosemirror-highlight/dist/index.js", "prosemirror-view"],
  o13v: ["orig hl + orig view 1.41", "./pristine/dist/index.js", "../pm-decorations/builds/view-1.41-orig/dist/index.js"],
  p13v: ["patched hl + orig view 1.41", "../../../../node_modules/prosemirror-highlight/dist/index.js", "../pm-decorations/builds/view-1.41-orig/dist/index.js"],
  // [label, plugin module, prosemirror-view module]
};
const libs = [];
for (const k of wanted) {
  const [name, plugin, view] = defs[k];
  libs.push({ key: k, name, hl: await import(plugin), view: await import(view) });
}

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    code_block: { content: "text*", group: "block", code: true, attrs: { language: { default: "js" } } },
    text: { group: "inline" },
  },
});

function makeParser(Decoration) {
  return ({ content, pos, size }) => {
    const out = [Decoration.node(pos, pos + size, { style: "--prosemirror-highlight:#111;--prosemirror-highlight-bg:#fff" })];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(content))) out.push(Decoration.inline(pos + 1 + m.index, pos + 1 + m.index + m[0].length, { style: "color:#a00", class: "shiki" }));
    return out;
  };
}
const codeText = (i) => Array.from({ length: tokens }, (_, t) => "tok" + ((i + t) % 7)).join(" ");

function buildDoc(n) {
  const blocks = [];
  for (let i = 0; i < n; i++) {
    if (i % 3 == 1) blocks.push(schema.nodes.code_block.create({ language: "js" }, schema.text(codeText(i))));
    else blocks.push(schema.nodes.paragraph.create(null, schema.text("Lorem ipsum dolor sit amet " + i)));
  }
  return schema.nodes.doc.create(null, blocks);
}
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const fmt = (ms) => (ms == null ? "n/a" : ms >= 1000 ? (ms / 1000).toFixed(2) + " s" : ms.toFixed(1) + " ms");

for (const n of cases) {
  const doc = buildDoc(n);
  // positions: a paragraph in the middle, a code block in the middle
  let pPos = 0, cPos = 0;
  doc.forEach((node, off) => {
    if (off < doc.content.size / 2) { if (node.type.name == "paragraph") pPos = off + 3; else cPos = off + 3; }
  });
  const S = {};
  for (const l of libs) S[l.key] = { init: [], typePara: [], selection: [], typeCode: [], renderPass: [], decos: 0, err: null };
  for (let r = 0; r < reps; r++) {
    for (const l of libs) {
      const s = S[l.key];
      try {
        const plugin = l.hl.createHighlightPlugin({ parser: makeParser(l.view.Decoration), nodeTypes: ["code_block"], languageExtractor: (nd) => nd.attrs.language });
        let t0 = performance.now();
        let state = EditorState.create({ doc, plugins: [plugin] });
        s.init.push(performance.now() - t0);
        // warm: first keystroke
        state = state.apply(state.tr.insertText("w", pPos));
        t0 = performance.now();
        state = state.apply(state.tr.insertText("x", pPos));
        s.typePara.push(performance.now() - t0);
        t0 = performance.now();
        state = state.apply(state.tr.setSelection(state.selection.constructor.near(state.doc.resolve(pPos))));
        s.selection.push(performance.now() - t0);
        t0 = performance.now();
        state = state.apply(state.tr.insertText("y", cPos));
        s.typeCode.push(performance.now() - t0);
        // what the view does for every top-level child on each update (iterDeco -> forChild)
        const set = plugin.getState(state).decorations;
        t0 = performance.now();
        let off = 0, cnt = 0;
        state.doc.forEach((child) => { if (set.forChild(off, child) != l.view.DecorationSet.empty) cnt++; off += child.nodeSize; });
        s.renderPass.push(performance.now() - t0);
        s.decos = set.find().length;
      } catch (e) {
        s.err = e.constructor.name + ": " + String(e.message).slice(0, 60);
      }
    }
  }
  console.log(`\n### ${n} top-level blocks, ${Math.floor(n / 3)} code blocks x ${tokens} tokens (${reps} samples, median, interleaved)`);
  console.log("| setup | init | type in paragraph | selection-only tr | type in code block | forChild pass (view) | decos |");
  console.log("|---|---|---|---|---|---|---|");
  for (const l of libs) {
    const s = S[l.key];
    if (s.err && !s.init.length) { console.log(`| ${l.name} | ${s.err} | | | | | |`); continue; }
    console.log(`| ${l.name} | ${fmt(median(s.init))} | ${fmt(median(s.typePara))} | ${fmt(median(s.selection))} | ${fmt(median(s.typeCode))} | ${fmt(median(s.renderPass))} | ${s.decos} |`);
  }
}
