import type { SchemaSpec } from "prosemirror-model";

export const specification: SchemaSpec = {
  nodes: {
    doc: { content: "block+" },
    text: { inline: true, group: "inline" },

    paragraph: {
      group: "block",
      content: "inline*",
      parseDOM: [{ tag: "p" }],
      toDOM: (node) => ["p", 0]
    },
    blockquote: {
      group: "block",
      content: "block+",
      parseDOM: [{ tag: "blockquote" }],
      toDOM: () => ["blockquote", 0]
    },
    heading: {
      attrs: { level: { default: 1 } },
      content: "(text | image)*",
      group: "block",
      defining: true,
      parseDOM: [
        { tag: "h1", attrs: { level: 1 } },
        { tag: "h2", attrs: { level: 2 } },
        { tag: "h3", attrs: { level: 3 } },
        { tag: "h4", attrs: { level: 4 } },
        { tag: "h5", attrs: { level: 5 } },
        { tag: "h6", attrs: { level: 6 } }
      ],
      toDOM: (node) => [`h${node.attrs.level}`, 0]
    },
    image: {
      inline: true,
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null }
      },
      group: "inline",
      parseDOM: [{
        tag: "img[src]", getAttrs(dom) {
          return {
            src: dom.getAttribute("src"),
            title: dom.getAttribute("title"),
            alt: dom.getAttribute("alt")
          }
        }
      }],
      toDOM: (node) => ["img", node.attrs]
    },
    horizontal_rule: {
      group: "block",
      parseDOM: [{ tag: "hr" }],
      toDOM: () => ["hr"]
    },
    bullet_list: {
      group: "block",
      content: "list_item+",
      parseDOM: [{ tag: "ul" }],
      toDOM: (node) => ["ul", 0]
    },
    ordered_list: {
      group: "block",
      content: "list_item+",
      attrs: {
        order: { default: 1 }
      },
      parseDOM: [{ tag: "ol" }],
      toDOM: (node) => ["ol", { start: node.attrs.order }, 0]
    },
    list_item: {
      content: "paragraph*",
      defining: true,
      attrs: {
        value: { default: null }
      },
      parseDOM: [{ tag: "li" }],
      toDOM(node) { return ["li", node.attrs, 0] }
    },
    code_block: {
      group: "block",
      content: "inline*",
      code: true,
      defining: true,
      marks: "",
      attrs: {
        language: { default: "plaintext" },
        content: {default: "" }
      },
      parseDOM: [{ tag: "pre" }],
      toDOM: (node) => {
        return ["pre", { "data-language": node.attrs.language ?? "plaintext" }, ["code", 0]];
      }
    },
    hard_break: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{ tag: "br" }],
      toDOM: () => ["br"]
    },
    html_block: {
      group: "block",
      content: "block+",
      selectable: false,
      draggable: false,
      defining: true,
      attrs: { params: { default: {} } },
      toDOM: () => ["div", 0]
    },
    table: { group: "block", content: "(thead|tbody)+", parseDOM: [{ tag: "table" }], toDOM: () => ["table", 0] },
    thead: { group: "block", content: "tr{1}", parseDOM: [{ tag: "thead" }], toDOM: () => ["thead", 0] },
    tbody: { group: "block", content: "tr*", parseDOM: [{ tag: "tbody" }], toDOM: () => ["tbody", 0] },
    tr: { group: "block", content: "(th | td)*", parseDOM: [{ tag: "tr" }], toDOM: () => ["tr", 0] },
    td: { group: "block", content: "text*", parseDOM: [{ tag: "td" }], toDOM: () => ["td", 0] },
    th: { group: "block", content: "text*", parseDOM: [{ tag: "th" }], toDOM: () => ["th", 0] }
  },
  marks: {
    strong: {
      parseDOM: [
        { tag: "strong" },
        { tag: "b", getAttrs: (node) => node.style.fontWeight != "normal" && null },
        { style: "font-weight=400", clearMark: m => m.type.name == "strong" },
        { style: "font-weight", getAttrs: value => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null }
      ],
      toDOM() { return ["strong"] }
    },
    em: {
      parseDOM: [
        { tag: "i" },
        { tag: "em" },
        { style: "font-style=italic" },
        { style: "font-style=normal", clearMark: m => m.type.name == "em" }
      ],
      toDOM() { return ["em"] }
    },
    s: {
      parseDOM: [
        { tag: "s" },
      ],
      toDOM() { return ["s"] }
    },
    link: {
      attrs: {
        href: {},
        title: { default: null }
      },
      inclusive: true,
      parseDOM: [{
        tag: "a[href]",
        getAttrs(dom) {
          return { href: dom.getAttribute("href"), title: dom.getAttribute("title") }
        }
      }],
      toDOM(mark) { return ["a", mark.attrs] }
    },
    code: {
      code: true,
      parseDOM: [{ tag: "code" }],
      toDOM() { return ["code", 0] }
    },
  }
};