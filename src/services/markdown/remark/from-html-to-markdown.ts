import { unified } from "unified";
import remarkStringify from "remark-stringify";
import {
  fromProseMirror,
  fromPmNode,
  fromPmMark,
} from "@handlewithcare/remark-prosemirror";

import { type Node } from "prosemirror-model";

import { mySchema } from "@/services/prosemirror";

export async function proseMirrorToMarkdown(doc: Node) {
  const mdast = fromProseMirror(doc, {
    schema: mySchema,
    nodeHandlers: {
      doc: fromPmNode("root"),
      heading: fromPmNode("heading", (node) => ({ depth: node.attrs.level })),
      paragraph: fromPmNode("paragraph"),
      horizontal_rule: fromPmNode("thematicBreak"),
      blockquote: fromPmNode("blockquote"),
      code_block: fromPmNode("code", (node) => { return { lang: node.attrs.language, value: node.textContent } }),

      list_item: fromPmNode("listItem"),
      ordered_list: fromPmNode("list", (node) => ({
        ordered: true,
        start: node.attrs.order
      })),
      bullet_list: fromPmNode("list", () => ({
        ordered: false,
      })),

      table: fromPmNode("table"),
      image: fromPmNode("image", (node) => ({ url: node.attrs.src, title: node.attrs.title, alt: node.attrs.alt })),
      html_block: fromPmNode("html", node => ({ value: `</${node.attrs.params.tag}/>` }))
    },
    markHandlers: {
      em: fromPmMark("emphasis"),
      strong: fromPmMark("strong"),
      link: fromPmMark("link", (mark) => ({
        url: mark.attrs["href"],
        title: mark.attrs["title"],
      })),
    },
  });

  return unified()
    .use(remarkStringify)
    .stringify(mdast);
}