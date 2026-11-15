// Which GFM / frontmatter extension costs most on the real fixture, and does it scale linearly?
import { readFileSync } from "node:fs";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfm } from "micromark-extension-gfm";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfmAutolinkLiteral } from "micromark-extension-gfm-autolink-literal";
import { gfmAutolinkLiteralFromMarkdown } from "mdast-util-gfm-autolink-literal";
import { gfmTable } from "micromark-extension-gfm-table";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough";
import { gfmStrikethroughFromMarkdown } from "mdast-util-gfm-strikethrough";
import { gfmFootnote } from "micromark-extension-gfm-footnote";
import { gfmFootnoteFromMarkdown } from "mdast-util-gfm-footnote";
import { gfmTaskListItem } from "micromark-extension-gfm-task-list-item";
import { gfmTaskListItemFromMarkdown } from "mdast-util-gfm-task-list-item";
import { frontmatter } from "micromark-extension-frontmatter";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
const fixture = readFileSync("md/huge-file.md", "utf8").replace(/\r\n/g, "\n") + "\n\n";
const t = (fn) => { global.gc?.(); const s = performance.now(); fn(); return Math.round(performance.now() - s); };
const v = {
  core: [[], []], allGfm: [[gfm()], [gfmFromMarkdown()]],
  autolink: [[gfmAutolinkLiteral()], [gfmAutolinkLiteralFromMarkdown()]], table: [[gfmTable()], [gfmTableFromMarkdown()]],
  strike: [[gfmStrikethrough()], [gfmStrikethroughFromMarkdown()]], footnote: [[gfmFootnote()], [gfmFootnoteFromMarkdown()]],
  task: [[gfmTaskListItem()], [gfmTaskListItemFromMarkdown()]], frontmatter: [[frontmatter()], [frontmatterFromMarkdown()]],
};
console.log("MB | " + Object.keys(v).join(" | "));
for (const mb of [2, 4, 8, 16]) {
  const md = fixture.repeat(Math.round(mb * 1048576 / fixture.length));
  console.log(`${mb} | ` + Object.values(v).map(([e, m]) => t(() => fromMarkdown(md, { extensions: e, mdastExtensions: m }))).join(" | "));
}
