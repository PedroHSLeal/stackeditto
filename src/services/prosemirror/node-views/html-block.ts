import type { Decoration, DecorationSource, EditorView, NodeView } from "prosemirror-view"
import type { Node } from "prosemirror-model"

import { getUntrustedHtmlBlock } from "@/services/untrusted-code-extensions/registry/html-blocks";

/** Namespace dos atributos que marcam, no DOM, o container de cada bloco HTML. */
export const HTML_BLOCK_NAMESPACE = "stack-and-ditto";

export const HTML_BLOCK_ATTRIBUTE = {
  TAG: "tag",
  POSITION: "position",
} as const;

/** `</tag/>`: o que o serializador escreve no lugar do bloco até `getProsemirrorText` trocar pelo markdown da extensão. */
export const HTML_BLOCK_PLACEHOLDER = {
  of: (tag: string) => `</${tag}/>`,
  PATTERN: /<\/(.+?)\/>/g,
};

export class HtmlBlockView implements NodeView {
  dom: InstanceType<typeof window.Node>;

  constructor(node: Node, view: EditorView, getPos: () => number | undefined, decorations: readonly Decoration[], innerDecorations: DecorationSource) {
    const { tag, attrs, content } = node.attrs.params;

    const containerElement = document.createElement("div");
    containerElement.setAttributeNS(HTML_BLOCK_NAMESPACE, HTML_BLOCK_ATTRIBUTE.TAG, tag);
    containerElement.setAttributeNS(HTML_BLOCK_NAMESPACE, HTML_BLOCK_ATTRIBUTE.POSITION, getPos()!.toString());

    const element: HTMLElement = document.createElement(tag);

    for (const [key, value] of attrs ?? []) {
      element.setAttribute(key, value);
    }

    getUntrustedHtmlBlock(tag)?.init(element, content);

    containerElement.appendChild(element);

    this.dom = containerElement;
  }
}
