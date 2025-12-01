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

import { type Node } from "prosemirror-model";

import { mySchema } from "@/services/prosemirror";
import { chooseRegex } from "@/services/prosemirror/tokens/html-tokens";
import type { Value as UnifiedValue } from "~/unified/lib";

export async function markdownToProseMirror(markdown: UnifiedValue): Promise<Node> {
  const doc = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter)
    .use(remarkProseMirror, {
      schema: mySchema,
      handlers: remarkProsemirrorHandlers
    })
    .process(markdown);

  return doc.result;
}

const remarkProsemirrorHandlers = {
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
  code: (node, parent, state) => {
    const nodeType = mySchema.nodes.code_block;
    const createdNode = nodeType.createAndFill({ language: node.lang }, mySchema.text(node.value));
    return createdNode;
  },
  thematicBreak: toPmNode(mySchema.nodes.horizontal_rule),
  imageReference: (node, parent, state) => {
    if (!state.definitionById.has(node.identifier.toUpperCase()))
      return mySchema.nodes.paragraph.create();

    let imageRef = state.definitionById.get(node.identifier.toUpperCase());

    return mySchema.nodes.image.create({ src: imageRef?.url, title: imageRef?.title });
  },
  //TODO: tenho que ver o pq o footnote está inserido após o texto...
  footnoteReference: (node, parent, state) => {
    if (!state.footnoteById.has(node.identifier.toUpperCase()))
      return mySchema.nodes.paragraph.create();

    let footnoteRef = state.footnoteById.get(node.identifier.toUpperCase());

    if (footnoteRef?.children == undefined)
      return mySchema.nodes.paragraph.create();

    return footnoteRef!.children.map(c => state.all(c)).flat();
  },

  // TABLES:
  table: (node, parent, state) => {
    let tHeadType = mySchema.nodes.thead;
    let tBodyType = mySchema.nodes.tbody;

    let trType = mySchema.nodes.tr;
    let tdType = mySchema.nodes.td;
    let thType = mySchema.nodes.th;

    let head = node.children[0];
    let body = node.children.length == 1
      ? node.children[0]
      : node.children.slice(1);

    const children = [];

    if (head == body) {
      children.push(tBodyType.create({}, trType.create({}, body.children.map(cell => tdType.create({}, state.all(cell))))));
    }
    else {
      children.push(tHeadType.create({}, trType.create({}, head.children.map(cell => thType.create({}, state.all(cell))))));
      children.push(tBodyType.create({}, (body as TableRow[]).map(tr => trType.create({}, tr.children.map(cell => tdType.create({}, state.all(cell)))))));
    }

    return mySchema.nodes.table.create({}, children);
  },

  html: (node, parent, state) => {
    const htmlType = mySchema.nodes.html_block;
    const result = chooseRegex(node.value).find(r => !!r);

    return htmlType.createAndFill({ params: result });
  },

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

