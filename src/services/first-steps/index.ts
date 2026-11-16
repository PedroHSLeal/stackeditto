import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

import firstStepsMarkdown from "@/templates/primeiros-passos.md?raw";

// Os GIFs são gravados por scripts/guia-gifs em docs/guia/gifs; o markdown os referencia como `gifs/<nome>.gif`
// e aqui cada nome vira a URL que o Vite emitiu para o arquivo.
const gifUrls = Object.fromEntries(
  Object.entries(import.meta.glob("../../../docs/guia/gifs/*.gif", { eager: true, query: "?url", import: "default" }) as Record<string, string>)
    .map(([path, url]) => [path.split("/").pop()!, url])
);

type HastNode = { type: string, tagName?: string, properties?: Record<string, unknown>, children?: HastNode[] };

function walk(node: HastNode, fn: (node: HastNode) => void) {
  fn(node);
  node.children?.forEach(child => walk(child, fn));
}

function rehypeResolveGifs() {
  return (tree: HastNode) => walk(tree, (node) => {
    if (node.tagName != "img" || !node.properties) return;

    const src = String(node.properties.src ?? "");
    node.properties.src = gifUrls[src.split("/").pop()!] ?? src;
    node.properties.loading = "lazy";
  });
}

function rehypeExternalLinks() {
  return (tree: HastNode) => walk(tree, (node) => {
    if (node.tagName != "a" || !node.properties) return;

    node.properties.target = "_blank";
    node.properties.rel = "noopener noreferrer";
  });
}

let cachedHtml: string | null = null;

export function useFirstSteps() {
  /** O documento é estático (vem do bundle), então converte uma vez só. HTML cru do markdown é descartado pelo remark-rehype. */
  function renderHtml(): string {
    cachedHtml ??= String(
      unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype)
        .use(rehypeResolveGifs)
        .use(rehypeExternalLinks)
        .use(rehypeStringify)
        .processSync(firstStepsMarkdown)
    );

    return cachedHtml;
  }

  return { renderHtml };
}