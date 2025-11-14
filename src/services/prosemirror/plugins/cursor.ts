import { Plugin, Transaction } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export const cursorPlugin = new Plugin<DecorationSet>({
  state: {
    init: (config, instance) => {
      return DecorationSet.empty;
    },
    apply: (tr, value, oldState, newState) => {
      let v = styleTextNodes(tr, "heading");
      return v.map(tr.mapping, tr.doc);
    },
  },
  props: {
    decorations: (state): DecorationSet => {
      if (!state.selection.empty) return DecorationSet.empty;

      return cursorPlugin.getState(state)!;
    }
  }
})

function styleTextNodes(tr: Transaction, nodeType: string): DecorationSet {
  let doc = tr.doc;
  let node = tr.selection.$anchor.node();
  let headingLevel = node.attrs.level;

  let headerDecorations: Decoration[] = [];

  doc.forEach((n, offset, i) => {
    let isCursorInDesiredElement = node === n && node.type.name == nodeType;

    if (isCursorInDesiredElement) {
      console.log(`estou no ${nodeType}`, offset, i);
      headerDecorations.push(Decoration.widget(offset + 1, (view, getPos) => {
        let hashes = document.createElement("span");
        hashes.innerText = "#".repeat(headingLevel) + " ";

        hashes.setAttribute("contenteditable", "false");
        hashes.style.color = "grey";

        return hashes;
      }, { side: -1, ignoreSelection: true }));
    }
  });

  return DecorationSet.create(doc, headerDecorations);
}