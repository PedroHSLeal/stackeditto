// One giant code block (default 400k tokens, ~2 MB): reproduces the stack overflow of prosemirror-highlight 0.13.0 and
// checks the patched build. usage: node giant-block.mjs [tokens=400000]
import { Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";

const tokens = +(process.argv[2] ?? 400000);
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    code_block: { content: "text*", group: "block", code: true, attrs: { language: { default: "js" } } },
    text: { group: "inline" },
  },
});
const text = Array.from({ length: tokens }, (_, i) => "tk" + (i % 10)).join(" ");
const doc = schema.nodes.doc.create(null, schema.nodes.code_block.create({ language: "js" }, schema.text(text)));
console.log(`giant block: ${text.length} chars, ${tokens} tokens`);

const defs = [
  ["orig 0.13.0 + view 1.41.0", "./builds/hl-0.13-orig/dist/index.js", "prosemirror-view"],
  ["patched 0.13.0 + patched view 1.42.9", "./builds/hl-0.13-patched-pv/dist/index.js", "./builds/view-1.42-patched/dist/index.js"],
  ["orig 0.16.0 + view 1.42.9", "./builds/hl-0.16-orig-v42/dist/index.js", "./builds/view-1.42-orig/dist/index.js"],
  ["patched 0.16.0 + patched view 1.42.9", "./builds/hl-0.16-patched-pv/dist/index.js", "./builds/view-1.42-patched/dist/index.js"],
];
for (const [name, plugin, view] of defs) {
  const hl = await import(plugin), { Decoration } = await import(view);
  const parser = ({ content, pos, size }) => {
    const out = [Decoration.node(pos, pos + size, { style: "--bg:#fff" })];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(content))) out.push(Decoration.inline(pos + 1 + m.index, pos + 1 + m.index + m[0].length, { style: "color:#a00", class: "shiki" }));
    return out;
  };
  const p = hl.createHighlightPlugin({ parser, nodeTypes: ["code_block"], languageExtractor: (n) => n.attrs.language });
  try {
    let t0 = performance.now();
    let state = EditorState.create({ doc, plugins: [p] });
    const init = performance.now() - t0;
    t0 = performance.now();
    state = state.apply(state.tr.insertText("x", 5));
    const type = performance.now() - t0;
    console.log(`${name}: init ${init.toFixed(0)} ms, keystroke in the block ${type.toFixed(0)} ms, decorations ${p.getState(state).decorations.find().length}`);
  } catch (e) {
    console.log(`${name}: ${e.constructor.name}: ${e.message}`);
  }
}
