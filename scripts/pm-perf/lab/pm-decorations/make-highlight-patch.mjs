// Applies the incremental-update patch to a prosemirror-highlight package directory (installed 0.13.0 or upstream 0.16.0).
// usage: node make-highlight-patch.mjs <srcPkgDir> <outPkgDir> [viewImport]
// viewImport (optional) rewrites the "prosemirror-view" import, used by the benchmark to run on top of the patched view.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [src, out, viewImport] = process.argv.slice(2);
// HL_BIG_BLOCK: blocks with more characters than this are handled by the full path (-1 forces the full path for any edit; used by tests)
const bigBlock = process.env.HL_BIG_BLOCK ?? "20000";
const here = path.dirname(fileURLToPath(import.meta.url));
const version = JSON.parse(fs.readFileSync(path.join(src, "package.json"), "utf8")).version;
const is016 = !version.startsWith("0.13");
const helpers = fs
  .readFileSync(path.join(here, "highlight-helpers.js.txt"), "utf8")
  .replace("__BIG_BLOCK__", bigBlock)
  .replace(
    "  if (result instanceof Promise) promises.push(result);\n  return null;",
    "  if (result instanceof Promise) promises.push(result);" +
      (is016 ? '\n  else console.error(`[prosemirror-highlight] Invalid parser result:`, result);' : "") +
      "\n  return null;",
  );

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

function patch013(t) {
  t = once(t, '  const key = new PluginKey("prosemirror-highlight");\n', '  const key = new PluginKey("prosemirror-highlight");\n  const parsed = /* @__PURE__ */ new WeakMap();\n', "key");
  t = once(
    t,
    /      init\(_, instance\) \{[\s\S]*?\n    view: \(view\) => \{/,
    `      init(_, instance) {
        const cache = new DecorationCache();
        const [decorations, promises] = calculateDecoration(
          instance.doc,
          parser,
          nodeTypes,
          languageExtractor,
          parsed
        );
        return { cache, decorations, promises };
      },
      apply: (tr, data) => {
        const refresh = !!tr.getMeta("prosemirror-highlight-refresh");
        if (!tr.docChanged && !refresh) {
          const decorations2 = data.decorations.map(tr.mapping, tr.doc);
          return { cache: data.cache, decorations: decorations2, promises: data.promises };
        }
        if (!refresh) {
          const updated = updateDecorations(tr, data, parser, nodeTypes, languageExtractor, parsed);
          if (updated) return { cache: data.cache, decorations: updated.set, promises: updated.promises };
        }
        const [decorations, promises] = calculateDecoration(
          tr.doc,
          parser,
          nodeTypes,
          languageExtractor,
          parsed
        );
        return { cache: data.cache, decorations, promises };
      }
    },
    view: (view) => {`,
    "state",
  );
  t = once(
    t,
    /function calculateDecoration\([\s\S]*?\n\}\nexport \{/,
    helpers +
      `function calculateDecoration(doc, parser, nodeTypes, languageExtractor, parsed) {
  const result = [];
  const promises = [];
  doc.descendants((node, pos) => {
    if (!node.type.isTextblock) {
      return true;
    }
    if (nodeTypes.includes(node.type.name)) {
      const decorations = parseCodeBlock(node, pos, parser, languageExtractor, parsed, promises);
      if (decorations) appendAll(result, decorations);
    }
    return false;
  });
  return [DecorationSet.create(doc, result), promises];
}
export {`,
    "calculateDecoration",
  );
  return t;
}

function patch016(t) {
  t = once(t, '\tconst key = new PluginKey("prosemirror-highlight");\n', '\tconst key = new PluginKey("prosemirror-highlight");\n\tconst parsed = /* @__PURE__ */ new WeakMap();\n', "key");
  t = once(
    t,
    /\t\t\tinit\(_, instance\) \{[\s\S]*?\n\t\tview: \(view\) => \{/,
    `\t\t\tinit(_, instance) {
\t\t\t\tconst cache = new DecorationCache();
\t\t\t\tconst [decorations, promises] = calculateDecoration(instance.doc, parser, nodeTypes, languageExtractor, parsed);
\t\t\t\treturn {
\t\t\t\t\tcache,
\t\t\t\t\tdecorations,
\t\t\t\t\tpromises
\t\t\t\t};
\t\t\t},
\t\t\tapply: (tr, data) => {
\t\t\t\tconst refresh = !!tr.getMeta("prosemirror-highlight-refresh");
\t\t\t\tif (!tr.docChanged && !refresh) return {
\t\t\t\t\tcache: data.cache,
\t\t\t\t\tdecorations: data.decorations?.map(tr.mapping, tr.doc),
\t\t\t\t\tpromises: data.promises
\t\t\t\t};
\t\t\t\tif (!refresh) {
\t\t\t\t\tconst updated = updateDecorations(tr, data, parser, nodeTypes, languageExtractor, parsed);
\t\t\t\t\tif (updated) return {
\t\t\t\t\t\tcache: data.cache,
\t\t\t\t\t\tdecorations: updated.set == DecorationSet.empty ? void 0 : updated.set,
\t\t\t\t\t\tpromises: updated.promises
\t\t\t\t\t};
\t\t\t\t}
\t\t\t\tconst [decorations, promises] = calculateDecoration(tr.doc, parser, nodeTypes, languageExtractor, parsed);
\t\t\t\treturn {
\t\t\t\t\tcache: data.cache,
\t\t\t\t\tdecorations,
\t\t\t\t\tpromises
\t\t\t\t};
\t\t\t}
\t\t},
\t\tview: (view) => {`,
    "state",
  );
  t = once(
    t,
    /function calculateDecoration\([\s\S]*?\n\}\nfunction collectCodeBlocks/,
    helpers +
      `function calculateDecoration(doc, parser, nodeTypes, languageExtractor, parsed) {
\tconst allDecorations = [];
\tconst promises = [];
\tconst nodes = collectCodeBlocks(doc, nodeTypes);
\ttry {
\t\tfor (const [node, pos] of nodes) {
\t\t\tconst decorations = parseCodeBlock(node, pos, parser, languageExtractor, parsed, promises);
\t\t\tif (decorations) appendAll(allDecorations, decorations);
\t\t}
\t} catch (error) {
\t\tconsole.error(\`[prosemirror-highlight] Error parsing code blocks:\`, error);
\t}
\treturn [allDecorations.length > 0 ? DecorationSet.create(doc, allDecorations) : void 0, promises];
}
function collectCodeBlocks`,
    "calculateDecoration",
  );
  return t;
}

fs.mkdirSync(path.join(out, "dist"), { recursive: true });
let js = fs.readFileSync(path.join(src, "dist/index.js"), "utf8");
js = is016 ? patch016(js) : patch013(js);
if (viewImport) js = js.replace('from "prosemirror-view"', `from "${viewImport}"`);
fs.writeFileSync(path.join(out, "dist/index.js"), js);
// the other entry points (shiki.js, ...) are untouched; copy everything so the folder is usable as a drop-in
for (const f of fs.readdirSync(path.join(src, "dist"))) if (f != "index.js") fs.copyFileSync(path.join(src, "dist", f), path.join(out, "dist", f));
fs.copyFileSync(path.join(src, "package.json"), path.join(out, "package.json"));
console.log("patched highlight", version, "->", out);
