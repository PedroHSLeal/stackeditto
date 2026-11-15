// npx vite-node scripts/pm-perf/lab/open-parallel/equivalence.ts [sizeMB] [chunkKB]
// Single-pass parse vs split -> parse chunks -> assemble, with the app's markdownToProseMirror.
import { buildCorpus, type CorpusKind } from "../../../../playground/pm-perf/corpus";
import { splitMarkdown } from "../../../../playground/open-parallel-lab/split";
import { assemble } from "../../../../playground/open-parallel-lab/assemble";
import { markdownToProseMirror } from "@/services/markdown/remark/from-markdown-to-html";

const sizeMB = Number(process.argv[2] ?? 1);
const chunkKB = Number(process.argv[3] ?? 64);

async function check(label: string, text: string, chunkBytes = chunkKB * 1024) {
  let t = performance.now();
  const single = await markdownToProseMirror(text);
  const tSingle = performance.now() - t;
  t = performance.now();
  const sp = splitMarkdown(text, chunkBytes);
  const tSplit = performance.now() - t;
  t = performance.now();
  const parts = [];
  for (const c of sp.chunks) parts.push({ nodes: [...(await markdownToProseMirror(c.text + sp.preamble)).content.content], joinList: c.joinList });
  const tChunks = performance.now() - t;
  const doc = assemble(parts);
  const eq = doc.eq(single);
  let diff = "";
  if (!eq) {
    const n = Math.min(doc.childCount, single.childCount);
    let k = 0; while (k < n && doc.child(k).eq(single.child(k))) k++;
    diff = ` first-diff-block=${k}/${single.childCount} (chunked ${doc.childCount}) single=${JSON.stringify(single.maybeChild(k)?.toJSON()).slice(0, 160)} chunked=${JSON.stringify(doc.maybeChild(k)?.toJSON()).slice(0, 160)}`;
  }
  console.log(`${eq ? "EQUAL " : "DIFFER"} ${label.padEnd(26)} ${(text.length / 1048576).toFixed(2)}MB chunks=${sp.chunks.length} joins=${sp.chunks.filter((c) => c.joinList).length} defs=${sp.defs} single=${tSingle.toFixed(0)}ms split=${tSplit.toFixed(0)}ms chunked(seq)=${tChunks.toFixed(0)}ms${diff}`);
  return eq;
}

const kinds: [CorpusKind, number][] = [["fixture", sizeMB], ["prose", sizeMB], ["fenced", sizeMB], ["html", sizeMB], ["lists", Math.min(sizeMB, 0.5)], ["tables", Math.min(sizeMB, 0.5)]];
for (const [kind, mb] of kinds) await check(kind, await buildCorpus(kind, mb).text());

// hand-made hazards
const hazards: Record<string, string> = {
  "refs+footnotes": "# T\n\nSee [a][r1] and ![img][i1] and note[^1].\n\n" + "para\n\n".repeat(50) + "later [b][r1] and again[^1].\n\n" + "x\n\n".repeat(50) + "[r1]: http://example.com \"t\"\n[i1]: http://img/x.png\n\n[^1]: The note\n    continues here.\n\nend [c][r1]\n",
  "front matter": "---\ntitle: x\n\nother: y\n---\n\n" + "para\n\n".repeat(80),
  "fence w/ blanks": "```ts\na\n\nb\n\n\nc\n```\n\n" + "p\n\n".repeat(40) + "~~~~\nx\n\n~~~\n\ny\n~~~~\n\nend\n",
  "html comment/pre": "<!--\nblank\n\ninside\n-->\n\n" + "p\n\n".repeat(40) + "<pre>\n\nx\n\n</pre>\n\n<script>\n\n</script>\n\nend\n",
  "list continuation": "- a\n\n  para in item\n\n- b\n\n" + "- x\n\n".repeat(60) + "1. one\n\n2. two\n\n" + "3. t\n\n".repeat(60) + "* star\n\n- dash\n\n- dash2\n\ntext\n\n- new list\n",
  "indented code": "    code a\n\n    code b\n\n" + "p\n\n".repeat(40) + "    code c\n\n    code d\n\nend\n",
  "setext+hr": "Title\n=====\n\n" + "p\n\n".repeat(40) + "Sub\n---\n\n---\n\n* * *\n\nend\n",
  "blockquote": "> a\n\n> b\n\n" + "p\n\n".repeat(40) + "> c\n> d\n\n> e\n\nend\n",
  "table": "| a | b |\n|---|---|\n| 1 | 2 |\n\n" + "p\n\n".repeat(40) + "| a | b |\n|---|---|\n| 1 | 2 |\n\nend\n",
  "html custom tags": "<x-a foo=\"1\">\nhi\n</x-a>\n\n" + "p\n\n".repeat(40) + "<x-a>\n\nsplit by blank\n\n</x-a>\n\nend <b>x</b>\n",
  "CRLF": "# a\r\n\r\n" + "p one\r\n\r\n".repeat(40) + "- l\r\n\r\n- m\r\n\r\nend\r\n",
};
let bad = 0;
for (const [k, v] of Object.entries(hazards)) if (!(await check("hazard: " + k, v, 100))) bad++;
console.log(bad ? `${bad} hazard(s) differ` : "all hazards equal");

// negative control: without the preamble, reference-style content must differ (proves the hazard test is live)
{
  const text = hazards["refs+footnotes"];
  const single = await markdownToProseMirror(text);
  const sp = splitMarkdown(text, 100);
  const parts = [];
  for (const c of sp.chunks) parts.push({ nodes: [...(await markdownToProseMirror(c.text)).content.content], joinList: c.joinList });
  console.log("control (no preamble) differs from single:", !assemble(parts).eq(single));
}
if (process.argv[4] == "big") for (const mb of [8]) await check(`fixture@${mb}`, await buildCorpus("fixture", mb).text(), 256 * 1024);
