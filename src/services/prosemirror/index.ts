import { baseKeymap } from "prosemirror-commands";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { keymap } from "prosemirror-keymap";
import { Schema } from "prosemirror-model";
import { EditorState, Selection, Transaction } from "prosemirror-state";
import { EditorView, type NodeViewConstructor } from "prosemirror-view";

import { createHighlightPlugin } from 'prosemirror-highlight';
import { createParser } from 'prosemirror-highlight/shiki';
import { getSingletonHighlighter } from 'shiki';

import { buildInputRules } from "./input-rules";
import { buildKeymap } from "./keymaps";
import { specification } from "./schema";
import { codeBlockKeymaps, CodeBlockView } from "./node-views/code";
import { HtmlBlockView } from "./node-views/html-block";
import { markdownToProseMirror, proseMirrorToMarkdown, type Value } from "../markdown/remark";
import { getUntrustedHtmlBlock } from "../untrusted-code-extensions";

let view: EditorView;

export const mySchema = new Schema(specification);

type NodeView = { [node: string]: NodeViewConstructor };

const highlighter = await getSingletonHighlighter({
  themes: ['github-light'],
  langs: ['javascript', 'typescript', 'python', 'csharp', 'powershell', 'asm'],
})

export const defaultNodeViews: NodeView = {
  html_block: (node, view, getPos, decorations, innerDecorations) => new HtmlBlockView(node, view, getPos, decorations, innerDecorations),
};

export function defaultView(element: Element, state: EditorState, nodeViews: NodeView) {
  view = new EditorView(element, {
    state,
    nodeViews
  });

  return view;
}

export function getView(): EditorView | undefined { return view; }

export async function buildViewState(content: Value) {
  return EditorState.create({
    doc: await markdownToProseMirror(content),
    plugins: [
      buildInputRules(mySchema),

      keymap(baseKeymap),

      keymap(buildKeymap(mySchema)),
      keymap(codeBlockKeymaps),

      dropCursor(),
      gapCursor(),
      createHighlightPlugin({ parser: createParser(highlighter), nodeTypes: ['code_block'] }),
    ],
  })
}

export function updateView(view: EditorView, content: Value) {
  buildViewState(content)
    .then(state => view.updateState(state));
}

export async function getViewTextContent() {
  let outsideHtmlMap: Map<string, string> = new Map();

  for (const childElement of getView()!.dom.children) {
    let tag = childElement.getAttributeNS("stack-and-ditto", "tag");
    let position = childElement.getAttributeNS("stack-and-ditto", "position")

    if (tag && position) {
      let result = getUntrustedHtmlBlock(tag)?.toMarkdown(childElement, childElement.firstElementChild, null) ?? "";

      outsideHtmlMap.set(`${tag}___${position}`, `<${tag}>\n${result}\n</${tag}>`);
    }
  }

  let markdownContent = await proseMirrorToMarkdown(getView()!.state.doc);

  for (const key of outsideHtmlMap.keys()) {
    let [tag] = key.split("___");
    markdownContent = markdownContent.replace(`</${tag}/>`, outsideHtmlMap.get(key)!);
  }

  return markdownContent;
}