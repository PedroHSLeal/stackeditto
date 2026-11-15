import type { Node } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { createParser } from "prosemirror-highlight/shiki";
import { getSingletonHighlighter } from "shiki";

import { extractLanguageForHighlight, plainText } from "@/services/prosemirror/plugins/shiki-code-block";

/**
 * SPIKE: replacement candidate for createHighlightPlugin.
 *
 * prosemirror-highlight rebuilds a DecorationSet for the whole document on every
 * document change, and DecorationSet.create scans every decoration for every
 * top-level block. Here a keystroke maps the existing set and re-tokenizes only the
 * code block it touched; typing in a paragraph never reaches Shiki. Blocks with no
 * known grammar ("plaintext") get no decorations at all, since they would not be
 * coloured anyway.
 */

// Same arguments as shiki-code-block.ts, so this returns the same singleton.
const highlighter = await getSingletonHighlighter({
  themes: ["github-light"],
  langs: ["javascript", "typescript", "python", "csharp", "powershell", "asm"],
});

const parse = createParser(highlighter);
const key = new PluginKey<DecorationSet>("incremental-highlight");

export function decorate(node: Node, pos: number): Decoration[] {
  const language = extractLanguageForHighlight(node.attrs.language);
  if (language == plainText) return [];

  return parse({ content: node.textContent, language, pos, size: node.nodeSize }) as Decoration[];
}

export function incrementalHighlightPlugin() {
  return new Plugin<DecorationSet>({
    key,
    state: {
      init(_, { doc }) {
        const decorations: Decoration[] = [];

        doc.descendants((node, pos) => {
          if (node.type.name == "code_block") decorations.push(...decorate(node, pos));
          return !node.isTextblock;
        });

        return DecorationSet.create(doc, decorations);
      },
      apply(tr, previous) {
        if (!tr.docChanged) return previous;

        let set = previous.map(tr.mapping, tr.doc);

        tr.mapping.maps.forEach((map, index) => {
          map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
            const after = tr.mapping.slice(index + 1);
            const from = Math.max(0, after.map(newStart, -1));
            const to = Math.min(tr.doc.content.size, after.map(newEnd, 1));

            tr.doc.nodesBetween(from, to, (node, pos) => {
              if (node.type.name != "code_block") return !node.isTextblock;

              set = set.remove(set.find(pos, pos + node.nodeSize)).add(tr.doc, decorate(node, pos));
              return false;
            });
          });
        });

        return set;
      },
    },
    props: {
      decorations: (state) => key.getState(state),
    },
  });
}
