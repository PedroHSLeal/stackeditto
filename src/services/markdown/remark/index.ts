import { proseMirrorToMarkdown } from "./from-html-to-markdown";
import { markdownToProseMirror } from "./from-markdown-to-html";

type Value = Parameters<typeof markdownToProseMirror>["0"];

export {
  proseMirrorToMarkdown,
  markdownToProseMirror,
  type Value
}