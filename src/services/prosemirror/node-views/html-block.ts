import type { Decoration, DecorationSource, EditorView, NodeView } from "prosemirror-view"
import type { Node } from "prosemirror-model"

import { getUntrustedHtmlBlock } from "@/services/untrusted-code-extensions/registry/html-blocks"

export class HtmlBlockView implements NodeView {
  dom: InstanceType<typeof window.Node>;

  view: EditorView;
  pos: number;

  constructor(node: Node, view: EditorView, getPos: () => number | undefined, decorations: readonly Decoration[], innerDecorations: DecorationSource) {
    this.view = view;
    this.pos = getPos()!;

    const containerElement = document.createElement("div");
    containerElement.setAttributeNS("stack-and-ditto", "tag", node.attrs.params.tag);
    containerElement.setAttributeNS("stack-and-ditto", "position", this.pos.toString());

    const element: HTMLElement = document.createElement(node.attrs.params.tag);

    if (node.attrs.params.attrs) {
      for (const [key, value] of node.attrs.params.attrs) {
        element.setAttribute(key, value);
      }
    }

    const customElementRegistry = getUntrustedHtmlBlock(node.attrs.params.tag);

    if (customElementRegistry) {
      customElementRegistry.init(element, node.attrs.params.content);
    }

    containerElement.appendChild(element);

    this.dom = containerElement;
  }
}
