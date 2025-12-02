import { baseKeymap } from "prosemirror-commands";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { keymap } from "prosemirror-keymap";
import { Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { EditorView, type NodeViewConstructor } from "prosemirror-view";

import { buildInputRules } from "./input-rules";
import { buildKeymap } from "./keymaps";
import { specification } from "./schema";
import { HtmlBlockView } from "./node-views/html-block";
import { markdownToProseMirror, proseMirrorToMarkdown, type Value } from "../markdown/remark";
import { getUntrustedHtmlBlock } from "../untrusted-code-extensions";
import { highlightPlugin } from "./plugins/shiki-code-block";

let defaultView: EditorView;

export const mySchema = new Schema(specification);

export const defaultNodeViews: { [node: string]: NodeViewConstructor } = {
  html_block: (node, view, getPos, decorations, innerDecorations) => new HtmlBlockView(node, view, getPos, decorations, innerDecorations),
};

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
    plugins: [
      buildInputRules(mySchema),

      keymap(baseKeymap),

      keymap(buildKeymap(mySchema)),

      dropCursor(),
      gapCursor(),
      highlightPlugin
    ],
  })
}

export async function updateProsemirrorView(view: EditorView, content: Value) {
  let state = await buildProsemirrorState(content)
  view.updateState(state);
}

export async function getProsemirrorText(view?: EditorView) {
  let chosenView = view ?? defaultView;
  let outsideHtmlMap: Map<string, string> = new Map();

  for (const childElement of chosenView.dom.children) {
    let tag = childElement.getAttributeNS("stack-and-ditto", "tag");
    let position = childElement.getAttributeNS("stack-and-ditto", "position")

    if (tag && position) {
      let result = getUntrustedHtmlBlock(tag)?.toMarkdown(childElement, childElement.firstElementChild, null) ?? "";

      outsideHtmlMap.set(`${tag}___${position}`, `<${tag}>\n${result}\n</${tag}>`);
    }
  }

  let markdownContent = await proseMirrorToMarkdown(chosenView.state.doc);

  for (const key of outsideHtmlMap.keys()) {
    let [tag] = key.split("___");
    markdownContent = markdownContent.replace(`</${tag}/>`, outsideHtmlMap.get(key)!);
  }

  return markdownContent;
}

export function executeCommand(commandFn: (view: EditorView, state: EditorState, dispathFn: EditorView["dispatch"]) => unknown, view?: EditorView) {
  let chosenView = view ?? defaultView;

  let state = chosenView.state;
  let dispatch = chosenView.dispatch;

  commandFn(chosenView, state, dispatch);
}