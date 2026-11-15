import type { TableRow } from "mdast";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import {
  remarkProseMirror,
  toPmNode,
  toPmMark,
  type RemarkProseMirrorOptions,
} from "@handlewithcare/remark-prosemirror";

import type { Node, NodeType } from "prosemirror-model";

import { mySchema } from "@/services/prosemirror/schema";
import { parseHtmlBlock } from "@/services/prosemirror/tokens/html-tokens";
import type { Value as UnifiedValue } from "~/unified/lib";

const handlers = {
  // NODES:
  root: toPmNode(mySchema.nodes.doc),
  heading: toPmNode(mySchema.nodes.heading, (node) => ({ level: node.depth })),
  paragraph: toPmNode(mySchema.nodes.paragraph),
  break: toPmNode(mySchema.nodes.hard_break),
  image: toPmNode(mySchema.nodes.image, ({ url, alt, title }) => ({ src: url, title, alt })),
  blockquote: toPmNode(mySchema.nodes.blockquote),
  list(node, _, state) {
    const children = state.all(node);
    const nodeType = node.ordered
      ? mySchema.nodes.ordered_list
      : mySchema.nodes.bullet_list;

    return nodeType.createAndFill({ order: node.start ?? 1 }, children);
  },
  listItem: toPmNode(mySchema.nodes.list_item),
  code: (node) => mySchema.nodes.code_block.createAndFill({ language: node.lang }, mySchema.text(node.value)),
  thematicBreak: toPmNode(mySchema.nodes.horizontal_rule),
  imageReference: (node, parent, state) => {
    let imageRef = state.definitionById.get(node.identifier.toUpperCase());

    if (!imageRef)
      return mySchema.nodes.paragraph.create();

    return mySchema.nodes.image.create({ src: imageRef.url, title: imageRef.title });
  },
  //TODO: tenho que ver o pq o footnote está inserido após o texto...
  footnoteReference: (node, parent, state) => {
    let footnoteRef = state.footnoteById.get(node.identifier.toUpperCase());

    if (footnoteRef?.children == undefined)
      return mySchema.nodes.paragraph.create();

    return footnoteRef.children.map(c => state.all(c)).flat();
  },

  // TABLES:
  // tabela de uma linha só vira só tbody; senão a primeira linha é o thead
  table: (node, parent, state) => {
    const { thead, tbody, tr, th, td } = mySchema.nodes;
    const [head, ...rows] = node.children;

    const tableRow = (row: TableRow, cellType: NodeType) =>
      tr.create({}, row.children.map(cell => cellType.create({}, state.all(cell))));

    const children = rows.length == 0
      ? [tbody.create({}, tableRow(head, td))]
      : [
        thead.create({}, tableRow(head, th)),
        tbody.create({}, rows.map(row => tableRow(row, td))),
      ];

    return mySchema.nodes.table.create({}, children);
  },

  html: (node) => mySchema.nodes.html_block.createAndFill({ params: parseHtmlBlock(node.value) }),

  // MARKS:
  emphasis: toPmMark(mySchema.marks.em),
  strong: toPmMark(mySchema.marks.strong),
  link: toPmMark(mySchema.marks.link, (node) => {
    return {
      href: node.url,
      title: node.title,
    };
  }),
  inlineCode: toPmMark(mySchema.marks.code),
  delete: toPmMark(mySchema.marks.s),
} satisfies RemarkProseMirrorOptions['handlers'];

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter)
  .use(remarkProseMirror, {
    schema: mySchema,
    handlers
  })
  .freeze();

export async function markdownToProseMirror(markdown: UnifiedValue): Promise<Node> {
  const doc = await processor.process(markdown);

  return doc.result;
}
