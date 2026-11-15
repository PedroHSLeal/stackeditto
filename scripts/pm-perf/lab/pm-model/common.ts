import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { markdownToProseMirror } from "../../../../src/services/markdown/remark";
import { mySchema } from "../../../../src/services/prosemirror/schema";
import { buildInputRules } from "../../../../src/services/prosemirror/input-rules";
import { baseKeymap } from "prosemirror-commands";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { keymap } from "prosemirror-keymap";
import { buildKeymap } from "prosemirror-example-setup";
import { EditorState } from "prosemirror-state";

export { mySchema };
export const fixture = () => readFileSync("md/huge-file.md", "utf8").replace(/\r\n/g, "\n") + "\n\n";
export function mdOfMB(mb: number) {
  const f = fixture();
  return f.repeat(Math.max(1, Math.round((mb * 1024 * 1024) / Buffer.byteLength(f))));
}
export async function buildDoc(mb: number) {
  return await markdownToProseMirror(mdOfMB(mb));
}
export const plugins = () => [buildInputRules(mySchema), keymap(baseKeymap), keymap(buildKeymap(mySchema)), dropCursor(), gapCursor()];
export const mkState = (doc: any, withHistory = false) => EditorState.create({ doc, plugins: plugins() });
// textblock start positions (leaf textblocks) at roughly the given fraction
export function textblockNear(doc: any, frac: number) {
  const target = Math.floor(doc.content.size * frac);
  let found = -1;
  doc.nodesBetween(Math.max(0, target - 2000), Math.min(doc.content.size, target + 4000), (n: any, pos: number) => {
    if (found < 0 && n.isTextblock && n.content.size > 4 && n.firstChild?.isText && pos >= target) found = pos;
  });
  return found + 2;
}
