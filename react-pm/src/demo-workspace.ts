import hugeFileRaw from "<md>/huge-file.md?raw";

import type { Structure } from "@/services/file-system/in-memory/json-structure";

/**
 * Workspace em memória (backend "inMemory" do app, o mesmo do tour), para testar sem escolher pasta:
 * um arquivo de cada tipo de bloco e alguns arquivos grandes. Lembrete: o backend em memória tem as
 * lacunas descritas em docs/in-memory-fs-diagnosis.md (ex.: criar arquivo/pasta não aparece na árvore);
 * para testar o CRUD completo, use "Abrir pasta".
 */
const hugeFile = hugeFileRaw.replace(/\r\n/g, "\n");

const LOREM = "The quick brown fox jumps over the lazy dog while **strong words** and *emphasis* sit next to `inline code` and a [link](https://example.com/page) in the same sentence.";

const TS_SAMPLE = `export async function load<T>(url: string, retries = 3): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (response.ok) return (await response.json()) as T;
  }
  throw new Error("giving up on " + url);
}`;

const README = `# Stackeditto · react-prosemirror

Este workspace vive **só na memória** do navegador. Ele serve para comparar o editor do app (ProseMirror puro, em Vue) com o **@handlewithcare/react-prosemirror**, que renderiza o documento com o React.

- \`exemplos/\`: um arquivo por tipo de bloco (código com Shiki, tabelas, listas, bloco HTML de extensão).
- \`grandes/\`: arquivos de 0,6 MB a ~5 MB, para sentir abertura, digitação e rolagem.
- A barra de baixo mostra parse, montagem e a latência das teclas, medidos ao vivo.

Salve com **Ctrl+S**.
`;

const CODE = Array.from({ length: 12 }, (_, i) => `Trecho ${i + 1}:\n\n\`\`\`typescript\n${TS_SAMPLE}\n\`\`\`\n`).join("\n");

const TABLES = Array.from({ length: 10 }, (_, i) => `## Tabela ${i + 1}\n\n| id | name | note |\n| --- | --- | --- |\n${Array.from({ length: 8 }, (_, r) => `| ${r} | row ${r} of ${i} | ${LOREM.slice(0, 40)} |`).join("\n")}\n`).join("\n");

const LISTS = Array.from({ length: 10 }, (_, i) => `## Lista ${i + 1}\n\n${Array.from({ length: 8 }, (_, r) => `- item ${r}: ${LOREM.slice(0, 60)}`).join("\n")}\n`).join("\n");

const HTML_BLOCK = `# Bloco HTML de extensão

A extensão em \`.stackeditto/index.js\` registra a tag \`demo-callout\`. O node view é o mesmo do app (HtmlBlockView), passado ao react-prosemirror como construtor clássico.

<demo-callout>
Este bloco foi renderizado pela extensão do workspace.
</demo-callout>

Texto depois do bloco.
`;

const FENCED_1MB = Array.from({ length: 3000 }, (_, i) => `Parágrafo ${i} antes do código.\n\n\`\`\`typescript\n${TS_SAMPLE}\n\`\`\`\n`).join("\n");

const DEMO_EXTENSION = `registerHtmlBlock({
  htmlTag: "demo-callout",
  init: (element, content) => {
    element.textContent = content.trim();
    element.style.cssText = "display:block;padding:8px 12px;margin:8px 0;border-left:4px solid #a2d2ff;background:#f3f8ff;";
  },
  toMarkdown: (containerElement, element) => element?.textContent ?? "",
  toHtml: () => { },
});
`;

const file = (name: string, content: string) => ({ kind: "file" as const, name, content });
const directory = (name: string, children: Structure["children"]): Structure => ({ kind: "directory", name, children });

export function buildDemoStructure(): Structure {
  return directory("demo-react-pm", [
    file("LEIA-ME.md", README),
    file("notas.txt", "Arquivo que não é markdown: abre num editor de texto simples (o app usa Monaco)."),
    directory("exemplos", [
      file("blocos-de-codigo.md", `# Código\n\n${CODE}`),
      file("tabelas.md", `# Tabelas\n\n${TABLES}`),
      file("listas.md", `# Listas\n\n${LISTS}`),
      file("bloco-html.md", HTML_BLOCK),
    ]),
    directory("grandes", [
      file("huge-file.md", hugeFile),
      file("huge-file-x8.md", Array(8).fill(hugeFile).join("\n\n")),
      file("codigo-1mb.md", FENCED_1MB),
    ]),
    directory(".stackeditto", [file("index.js", DEMO_EXTENSION)]),
  ]);
}
