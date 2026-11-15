export type HtmlBlockParams = { tag: string, content?: string, attrs?: string[][] };

// <asdf-asdf_ASDF-123>(...)</asdf-asdf_ASDF-123>
const FULL_WITHOUT_ATTRS = /^<(?<tag>[\w-]+)>(?<content>.*)<\/[\w-]+>/ms;

// <asdf-asdf_ASDF-123 asdf="">(...)</asdf-asdf_ASDF-123>
const FULL_WITH_ATTRS = /^<(?<tag>[\w-]+) (?<attrs>(?:[\w-]+=".*"\s?)*)>(?<content>.*)<\/[\w-]+>/ms;

//<asdf-asdf_ASDF-123 /> || <asdf-asdf_ASDF-123>
const SELF_CLOSING = /^<(?<tag>[\w-]+\s*\/?)>/ms;

const htmlFullWithoutAttrs = (content: string): HtmlBlockParams | null => {
  const groups = FULL_WITHOUT_ATTRS.exec(content)?.groups;

  return groups ? { tag: groups.tag, content: groups.content } : null;
};

const htmlFullWithAttrs = (content: string): HtmlBlockParams | null => {
  const groups = FULL_WITH_ATTRS.exec(content)?.groups;

  if (!groups) return null;

  let attrs = groups.attrs.split(" ").map(attr => {
    let kv = attr.split("=");
    return [kv[0], kv[1].replace("\"", "")];
  })

  return { tag: groups.tag, content: groups.content, attrs };
};

const htmlSelfClosing = (content: string): HtmlBlockParams | null => {
  const groups = SELF_CLOSING.exec(content)?.groups;

  return groups ? { tag: groups.tag } : null;
};

/** Primeiro formato que casar, na ordem acima; `undefined` deixa o node com os params default. */
export function parseHtmlBlock(content: string): HtmlBlockParams | undefined {
  return htmlFullWithoutAttrs(content)
    ?? htmlFullWithAttrs(content)
    ?? htmlSelfClosing(content)
    ?? undefined;
}