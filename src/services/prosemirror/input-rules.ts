import {
  inputRules, wrappingInputRule, textblockTypeInputRule,
  smartQuotes, emDash, ellipsis,
  InputRule
} from "prosemirror-inputrules";
import { MarkType, NodeType, Schema } from "prosemirror-model";

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

export function codeBlockRule(nodeType: NodeType) {
  return textblockTypeInputRule(/^```$/, nodeType)
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

