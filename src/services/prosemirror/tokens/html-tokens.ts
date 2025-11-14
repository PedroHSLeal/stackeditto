import type { Attrs } from "prosemirror-model";
import type { ParseSpec } from "prosemirror-markdown";
import type Token from "~/@types/markdown-it/lib/token.mjs";

// <asdf-asdf_ASDF-123>(...)</asdf-asdf_ASDF-123>
const htmlFullWithoutAttrs = (content: string) => {
  let regex = /^(?<start_tag><(?:\w|\-|\_)+>)(?<content>(?:.|\n)*)(?<finish_tag><\/(?:\w|\-|\_)+>)/gms;
  let result = regex.exec(content);

  if (!result) return null;

  return {
    tag: result.groups!.start_tag.replace(/</, "")?.replace(/>/, ""),
    content: result.groups!.content
  }
};

// <asdf-asdf_ASDF-123 asdf="">(...)</asdf-asdf_ASDF-123>
const htmlFullWithAttrs = (content: string) => {
  let regex = /^(?<start_tag><(?:\w|\-|\_)+ (?<attrs>(?:(?:\w|\-|\_)+=".*"\s?)*)>)(?<content>(?:.|\n)*)(?<finish_tag><\/(?:\w|\-|\_)+>)/gms;
  let result = regex.exec(content)!;

  if (!result) return null;

  let attrs = result.groups!.attrs.split(" ").map(attr => {
    let kv = attr.split("=");
    return [kv[0], kv[1].replace("\"", "")];
  })

  return {
    tag: result.groups!.start_tag.replace(` ${result.groups!.attrs}`, "").replace(/</, "")?.replace(/>/, ""),
    content: result.groups!.content,
    attrs,
  }
};

//<asdf-asdf_ASDF-123 /> || <asdf-asdf_ASDF-123>
const htmlSelfClosing = (content: string) => {
  let regex = /^(?<tag><(?:\w|\-|\_)+\s*(?:\/)?>)/gms;
  let result = regex.exec(content);

  if (!result) return null;

  return {
    tag: result.groups!.tag.replace(/</, "")?.replace(/>/, ""),
  }
};

export function chooseRegex(content: string): ({ tag: string, content?: string, attrs?: string[][] } | null)[] {
  return [
    htmlFullWithoutAttrs(content),
    htmlFullWithAttrs(content),
    htmlSelfClosing(content),
  ]
}

function htmlAttrs(token: Token, tokenStream: Token[], index: number, typeFunc: (result: { tag: string, [p: string]: any }) => any): Attrs | null {
  let results = chooseRegex(token.content);
  let result = results.find(r => !!r)!;

  if (result) return typeFunc(result);
}

const block = (result: { tag: string, [p: string]: any }) => {
  return {
    ...result,
    tag: result!.tag
  };
}

const inline = (result: { tag: string, [p: string]: any }) => {
  return {
    ...result,
    tag: result!.tag
  };
}

export const htmlTokens: { [name: string]: ParseSpec } = {
  html_block: { node: "html_block", noCloseToken: true, getAttrs: (t, ts, i) => ({ params: htmlAttrs(t, ts, i, block) }) },
  html_inline: { mark: "html_inline", noCloseToken: true, getAttrs: (t, ts, i) => ({ params: htmlAttrs(t, ts, i, inline) }) },
}