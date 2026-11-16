import {
  inputRules, wrappingInputRule, textblockTypeInputRule,
  smartQuotes, emDash, ellipsis,
  InputRule
} from "prosemirror-inputrules";
import { MarkType, NodeType, Schema } from "prosemirror-model";

const ruleOptions = { undoable: true, inCode: false, inCodeMark: false };

// [texto](url "título") — compartilhado pelos atalhos de link e de imagem (`!` na frente)
const linkSyntax = /\[(?<alt>(?:\w|\s)*)\]\((?<url>(?:\S)+)(?:\s\"(?<title>.+)\")?\)\s$/.source;

export function buildInputRules(schema: Schema) {
  const { nodes, marks } = schema;

  return inputRules({
    rules: [
      ...smartQuotes, ellipsis, emDash,
      blockQuoteRule(nodes.blockquote),
      orderedListRule(nodes.ordered_list),
      bulletListRule(nodes.bullet_list),
      codeBlockRule(nodes.code_block),
      headingRule(nodes.heading),
      hrRule(nodes.horizontal_rule),
      imgRule(nodes.image),

      delimitedMarkRule("**", marks.strong),
      delimitedMarkRule("__", marks.em),
      delimitedMarkRule("~~", marks.s),
      linkRule(marks.link),
    ]
  });
}

export function blockQuoteRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*>\s$/, nodeType)
}

export function orderedListRule(nodeType: NodeType) {
  return wrappingInputRule(/^(\d+)\.\s$/, nodeType, match => {
    return { order: +match[1] };
  },
    (match, node) => node.childCount + node.attrs.order == +match[1])
}

export function bulletListRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*([-+*])\s$/, nodeType)
}

// ``` + espaço, ou ```js + espaço para já sair com a linguagem do realce
export function codeBlockRule(nodeType: NodeType) {
  return textblockTypeInputRule(/^```([\w#+-]*)\s$/, nodeType, match => ({ language: match[1] || undefined }))
}

export function headingRule(nodeType: NodeType) {
  return new InputRule(
    new RegExp("^(#{1,6})\\s$"),
    (state, match, start, end) => {
      let levelAttr = match[1].length;
      let isTransformingToHeading = false;
      let transaction = state.tr;

      transaction = transaction.setBlockType(start, undefined, nodeType, (oldNode) => {
        isTransformingToHeading = oldNode.type.name != "heading";

        return { level: levelAttr };
      });

      if (isTransformingToHeading) {
        transaction = transaction.delete(start, end);
      }

      return transaction;
    }, {})
}

export function hrRule(nodeType: NodeType) {
  return new InputRule(/^(—|--)\s$/, (state, match, start, end) => {
    let tr = state.tr;
    tr = tr.delete(start, end)
      .insert(start - 1, nodeType.create());

    return tr;
  }, ruleOptions);
}

/** `**negrito** `, `__itálico__ `, `~~riscado~~ `: delimitador de 2 caracteres seguido de espaço. */
export function delimitedMarkRule(delimiter: string, markType: MarkType) {
  const escaped = delimiter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new InputRule(new RegExp(`${escaped}\\s$`), (state, match) => {
    let stringToSearch = match.input ?? "";
    let firstDelimiter = stringToSearch.indexOf(delimiter);
    let secondDelimiter = stringToSearch.indexOf(delimiter, firstDelimiter + 2);

    if (firstDelimiter == -1 || secondDelimiter == -1) return null;

    return state.tr
      .delete(secondDelimiter + 1, secondDelimiter + 3)
      .delete(firstDelimiter, firstDelimiter + 3)
      .addMark(firstDelimiter, secondDelimiter, markType.create());
  }, ruleOptions);
}

export function imgRule(nodeType: NodeType) {
  return new InputRule(new RegExp(`^!${linkSyntax}`), (state, match, start, end) => {
    let tr = state.tr
      .delete(start, end)
      .insert(start - 1, nodeType.create({ src: match.groups?.url, alt: match.groups?.alt, title: match.groups?.title }));

    return tr;
  }, ruleOptions);
}

export function linkRule(markType: MarkType) {
  return new InputRule(new RegExp(`^${linkSyntax}`), (state, match, start, end) => {
    let tr = state.tr;
    let title = (match.groups?.alt ?? match.groups?.title) ?? "nao funcionou :(";

    tr = tr.delete(start, end)
      .insertText(title)
      .addMark(start, start + title.length, markType.create({ href: match.groups?.url }));

    return tr;
  }, ruleOptions);
}
