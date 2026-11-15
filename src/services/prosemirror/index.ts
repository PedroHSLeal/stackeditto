import { baseKeymap } from "prosemirror-commands";
import { dropCursor } from "prosemirror-dropcursor";
import { buildKeymap } from "prosemirror-example-setup";
import { gapCursor } from "prosemirror-gapcursor";
import { keymap } from "prosemirror-keymap";
import { EditorState } from "prosemirror-state";
import { EditorView, type NodeViewConstructor } from "prosemirror-view";

import { buildInputRules } from "./input-rules";
import { mySchema } from "./schema";
import { HtmlBlockView, HTML_BLOCK_ATTRIBUTE, HTML_BLOCK_NAMESPACE, HTML_BLOCK_PLACEHOLDER } from "./node-views/html-block";
import { markdownToProseMirror, proseMirrorToMarkdown, type Value } from "../markdown/remark";
import { getUntrustedHtmlBlock } from "../untrusted-code-extensions";
import { highlightPlugin } from "./plugins/shiki-code-block";

let defaultView: EditorView;

export { mySchema };

export const defaultNodeViews: { [node: string]: NodeViewConstructor } = {
  html_block: (...args) => new HtmlBlockView(...args),
};

// Só dependem do schema (fixo), então são criados uma vez e compartilhados por todos os states.
const plugins = [
  buildInputRules(mySchema),

  keymap(baseKeymap),

  keymap(buildKeymap(mySchema)),

  dropCursor(),
  gapCursor(),
  highlightPlugin
];

export function buildProsemirrorView(element: Element, state: EditorState, nodeViews: typeof defaultNodeViews) {
  defaultView = new EditorView(element, {
    state,
    nodeViews
  });

  return defaultView;
}

export async function buildProsemirrorState(content: Value) {
  return EditorState.create({
    doc: await markdownToProseMirror(content),
    plugins,
  })
}

export async function updateProsemirrorView(view: EditorView, content: Value) {
  let state = await buildProsemirrorState(content)
  view.updateState(state);
}

export async function getProsemirrorText(view?: EditorView) {
  let chosenView = view ?? defaultView;
  // markdown de cada bloco, por tag, na ordem em que aparecem no documento
  let outsideHtmlByTag: Map<string, string[]> = new Map();

  for (const childElement of chosenView.dom.children) {
    let tag = childElement.getAttributeNS(HTML_BLOCK_NAMESPACE, HTML_BLOCK_ATTRIBUTE.TAG);
    let position = childElement.getAttributeNS(HTML_BLOCK_NAMESPACE, HTML_BLOCK_ATTRIBUTE.POSITION);

    if (tag && position) {
      let result = getUntrustedHtmlBlock(tag)?.toMarkdown(childElement, childElement.firstElementChild, null) ?? "";

      if (!outsideHtmlByTag.has(tag)) outsideHtmlByTag.set(tag, []);
      outsideHtmlByTag.get(tag)!.push(`<${tag}>\n${result}\n</${tag}>`);
    }
  }

  let markdownContent = await proseMirrorToMarkdown(chosenView.state.doc);

  // uma única passada no texto, em vez de um replace no documento inteiro por bloco
  return markdownContent.replace(HTML_BLOCK_PLACEHOLDER.PATTERN, (placeholder, tag: string) =>
    outsideHtmlByTag.get(tag)?.shift() ?? placeholder);
}

export function executeCommand(commandFn: (view: EditorView, state: EditorState, dispathFn: EditorView["dispatch"]) => unknown, view?: EditorView) {
  let chosenView = view ?? defaultView;

  let state = chosenView.state;
  let dispatch = chosenView.dispatch;

  commandFn(chosenView, state, dispatch);
}