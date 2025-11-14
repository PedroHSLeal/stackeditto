import {
  inputRules, wrappingInputRule, textblockTypeInputRule,
  smartQuotes, emDash, ellipsis,
  InputRule
} from "prosemirror-inputrules";
import { Fragment, MarkType, Node, NodeType, Schema, Slice } from "prosemirror-model";
import { ReplaceStep } from "prosemirror-transform";
import { specification } from "./schema";

/// Given a blockquote node type, returns an input rule that turns `"> "`
/// at the start of a textblock into a blockquote.
export function blockQuoteRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*>\s$/, nodeType)
}

/// Given a list node type, returns an input rule that turns a number
/// followed by a dot at the start of a textblock into an ordered list.
export function orderedListRule(nodeType: NodeType) {
  return wrappingInputRule(/^(\d+)\.\s$/, nodeType, match => {
    return { order: +match[1] };
  },
    (match, node) => node.childCount + node.attrs.order == +match[1])
}

/// Given a list node type, returns an input rule that turns a bullet
/// (dash, plush, or asterisk) at the start of a textblock into a
/// bullet list.
export function bulletListRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*([-+*])\s$/, nodeType)
}

/// Given a code block node type, returns an input rule that turns a
/// textblock starting with three backticks into a code block.
export function codeBlockRule(nodeType: NodeType) {
  return textblockTypeInputRule(/^```$/, nodeType)
}

/// Given a node type and a maximum level, creates an input rule that
/// turns up to that number of `#` characters followed by a space at
/// the start of a textblock into a heading whose level corresponds to
/// the number of `#` signs.
export function headingRule(nodeType: NodeType) {
  return new InputRule(
    new RegExp("^(#{1,6})\\s$"),
    (state, match, start, end) => {
      let levelAttr = match[1].length;
      let nodeThatCursorIsAt = state.selection.$anchor.node();
      let isTransformingToHeading = false;
      let transaction = state.tr;

      transaction = transaction.setBlockType(start, undefined, nodeType, (oldNode) => {
        // se for só os "#" (pq o usuario pode comecar com um heading nivel 5, por exemplo)
        // if (oldNode.textContent.length == levelAttr) {
        //   transaction = state.tr.insertText(" ", levelAttr + 1);
        // }

        // se for o caso de, o usuario transformar de volta para um paragrafo...
        // e ele quiser de novo um cabecalho
        // MAS ele apagou o espaco que já havia antes de transformar em um cabecalho
        // if (new RegExp("^#{" + levelAttr + "}\\S").test(oldNode.textContent)) {
        //   transaction = state.tr.insertText(" ", levelAttr + 1);
        // }

        isTransformingToHeading = oldNode.type.name != "heading";

        return { level: levelAttr };
      });

      // let lastIndexOfSpaces = (anchorSelection.nodeAfter?.textContent.match(/\S/)?.index ?? levelAttr + 1);

      if (isTransformingToHeading) {
        transaction = transaction.delete(start, end);
      }

      /* if (nodeThatCursorIsAt.type.name == "heading") {
        if (/^#\s{2,}/.test(nodeThatCursorIsAt.text ?? "")) {
          const steps = new ReplaceStep(levelAttr, levelAttr + 1, Slice.empty);
          steps.apply(nodeThatCursorIsAt);
        }
      } */

      // adicionar um espaco APENAS entre o "#" e os caracteres
      // garantir que haja apenas um espaco separando o "#" do texto
      return transaction;
    }, {})
}

export function hrRule(nodeType: NodeType) {
  return new InputRule(/^(—|--)\s$/, (state, match, start, end) => {
    let tr = state.tr;
    tr = tr.delete(start, end)
      .insert(start - 1, nodeType.create());

    return tr;
  }, { undoable: true, inCode: false, inCodeMark: false });
}

export function strongRule(markType: MarkType) {
  return new InputRule(/\*{2}\s$/, (state, match, start, end) => {
    let stringToSearch = match.input ?? "";
    let firstPairOfDoubleStars = stringToSearch.indexOf("**");
    let secondPairOfDoubleStars = stringToSearch.indexOf("**", firstPairOfDoubleStars + 2);

    if (firstPairOfDoubleStars > -1 && secondPairOfDoubleStars > -1) {
      let tr = state.tr
        .delete(secondPairOfDoubleStars + 1, secondPairOfDoubleStars + 3)
        .delete(firstPairOfDoubleStars, firstPairOfDoubleStars + 3)
        .addMark(firstPairOfDoubleStars, secondPairOfDoubleStars, markType.create())

      return tr;
    }
    else return null;
  }, { undoable: true, inCode: false, inCodeMark: false });
}

export function italicRule(markType: MarkType) {
  return new InputRule(/\_{2}\s$/, (state, match, start, end) => {
    let stringToSearch = match.input ?? "";
    let firstPairOfDoubleStars = stringToSearch.indexOf("__");
    let secondPairOfDoubleStars = stringToSearch.indexOf("__", firstPairOfDoubleStars + 2);

    if (firstPairOfDoubleStars > -1 && secondPairOfDoubleStars > -1) {
      let tr = state.tr
        .delete(secondPairOfDoubleStars + 1, secondPairOfDoubleStars + 3)
        .delete(firstPairOfDoubleStars, firstPairOfDoubleStars + 3)
        .addMark(firstPairOfDoubleStars, secondPairOfDoubleStars, markType.create())

      return tr;
    }
    else return null;
  }, { undoable: true, inCode: false, inCodeMark: false });
}

export function strikethroughRule(markType: MarkType) {
  return new InputRule(/\~{2}\s$/, (state, match, start, end) => {
    let stringToSearch = match.input ?? "";
    let firstPairOfDoubleStars = stringToSearch.indexOf("~~");
    let secondPairOfDoubleStars = stringToSearch.indexOf("~~", firstPairOfDoubleStars + 2);

    if (firstPairOfDoubleStars > -1 && secondPairOfDoubleStars > -1) {
      let tr = state.tr
        .delete(secondPairOfDoubleStars + 1, secondPairOfDoubleStars + 3)
        .delete(firstPairOfDoubleStars, firstPairOfDoubleStars + 3)
        .addMark(firstPairOfDoubleStars, secondPairOfDoubleStars, markType.create())

      return tr;
    }
    else return null;
  }, { undoable: true, inCode: false, inCodeMark: false });
}

export function imgRule(nodeType: NodeType) {
  return new InputRule(/^!\[(?<alt>(?:\w|\s)*)\]\((?<url>(?:\S)+)(?:\s\"(?<title>.+)\")?\)\s$/, (state, match, start, end) => {
    let tr = state.tr
      .delete(start, end)
      .insert(start - 1, nodeType.create({ src: match.groups?.url, alt: match.groups?.alt, title: match.groups?.title }));

    return tr;
  }, { undoable: true, inCode: false, inCodeMark: false });
}

export function linkRule(markType: MarkType) {
  return new InputRule(/^\[(?<alt>(?:\w|\s)*)\]\((?<url>(?:\S)+)(?:\s\"(?<title>.+)\")?\)\s$/, (state, match, start, end) => {
    let tr = state.tr;
    let title = (match.groups?.alt ?? match.groups?.title) ?? "nao funcionou :(";

    tr = tr.delete(start, end)
      .insertText(title)
      .addMark(start, start + title.length, markType.create({ href: match.groups?.url }));

    return tr;
  }, { undoable: true, inCode: false, inCodeMark: false });
}

/* export function imgRule(nodeType: NodeType) {
  return new InputRule(/^\!\[(?<alt_text>:.+)\]\(\)/, (state, match, start, end) => { return state.tr });
} */

/// A set of input rules for creating the basic block quotes, lists,
/// code blocks, and heading.
export function buildInputRules(schema: Schema) {
  let rules = smartQuotes.concat(ellipsis, emDash), type
  if (type = schema.nodes.blockquote) rules.push(blockQuoteRule(type))
  if (type = schema.nodes.ordered_list) rules.push(orderedListRule(type))
  if (type = schema.nodes.bullet_list) rules.push(bulletListRule(type))
  if (type = schema.nodes.code_block) rules.push(codeBlockRule(type))
  if (type = schema.nodes.heading) rules.push(headingRule(type))
  if (type = schema.nodes.horizontal_rule) rules.push(hrRule(type))
  if (type = schema.nodes.image) rules.push(imgRule(type))

  if (type = schema.marks.strong) rules.push(strongRule(type));
  if (type = schema.marks.em) rules.push(italicRule(type));
  if (type = schema.marks.s) rules.push(strikethroughRule(type));
  if (type = schema.marks.link) rules.push(linkRule(type));

  return inputRules({ rules })
}