import { markdownToProseMirror } from "../../../src/services/markdown/remark/from-markdown-to-html";
for (const md of ["* a\n  * nested\n* b\n", "* a\n\n  ```js\n  x\n  ```\n* b\n", "* a\n  > quote\n* b\n"]) {
  const doc = await markdownToProseMirror(md);
  console.log(JSON.stringify(md), "→", doc.textContent, JSON.stringify(doc.toJSON()).slice(0, 300));
}
