import { record } from "./lib.mjs";

const OUT = process.argv[2];
const only = process.argv.slice(3);

const EXT = {
  ".stackeditto/index.js": `registerHtmlBlock({
  htmlTag: "cartao-aviso",
  init: (element, content) => {
    element.textContent = "💡 " + (content || "").trim();
    element.style.cssText = "display:block;padding:10px 14px;border-left:4px solid #9b6fd6;background:#f4ecff;border-radius:6px;margin:8px 0";
  },
  toMarkdown: (container, element) => element.textContent.replace("💡 ", ""),
  toHtml: () => { },
});
`,
  "notas/extensao.md": "# Bloco de extensão\n\nO bloco abaixo é desenhado pela extensão da pasta .stackeditto:\n\n<cartao-aviso>\nEste cartão foi renderizado por uma extensão JavaScript do próprio vault.\n</cartao-aviso>\n\nO resto do arquivo continua sendo markdown normal.\n",
};

const scenes = {
  async "01-abrir-workspace"(page, h) {
    await h.wait(500);
    await h.openVault();
    await h.caption("A pasta vira o workspace: a árvore aparece na lateral");
    await h.wait(1400);
    await h.click(h.tree("notas"));
    await h.caption("Clique numa pasta para expandir");
    await h.click(h.tree("ideias.md"), { pause: 900 });
    await h.caption("Clique num arquivo .md para abrir no editor");
    await h.wait(1800);
  },

  async "02-navegar-arquivos"(page, h) {
    await h.openVault();
    await h.caption("");
    await h.click(h.tree("notas"));
    await h.click(h.tree("ideias.md"), { pause: 700 });
    await h.click(h.tree("reuniao.md"), { pause: 700 });
    await h.click(h.tree("README.md"), { pause: 700 });
    await h.caption("“Arquivos abertos” guarda o que você já abriu (e as edições não salvas)");
    await h.wait(1200);
    await h.click(page.locator("#workspace-tab > div").first().getByText("ideias.md"), { pause: 1000 });
    await h.caption("Arquivos que não são .md abrem no Monaco (o editor do VS Code)");
    await h.click(h.tree("config.json"), { pause: 1600 });
    await h.caption("O botão ☰ esconde/mostra a lateral");
    await h.click(page.locator("#app-container button").first(), { pause: 900 });
    await h.click(page.locator("#app-container button").first(), { pause: 900 });
    await h.caption("");
  },

  async "03-escrever-markdown"(page, h) {
    await h.openVault();
    await h.caption("");
    await h.click(h.tree("README.md"), { pause: 600 });
    await h.caption("Escreva com atalhos de markdown: eles viram formatação na hora");
    await h.clickEnd(page.locator(".ProseMirror > p").first());
    await h.press("Enter");
    await h.type("## Novidades", 110);
    await h.press("Enter");
    await h.type("1. primeiro item", 110);
    await h.press("Enter");
    await h.type("segundo item", 110);
    await h.press("Enter"); await h.press("Enter");
    await h.type("- marcador", 110);
    await h.press("Enter"); await h.press("Enter");
    await h.type("> uma citação", 110);
    await h.wait(900);
    await h.caption("Ou use a barra do topo: H1–H6 e listas");
    await h.clickEnd(page.locator(".ProseMirror > h1").first());
    await h.press("Enter");
    await h.type("Título pela barra", 110);
    await h.caption("Ou use a barra do topo: selecione a linha e clique em H1–H6");
    const line = page.locator(".ProseMirror > p").first();
    await h.hover(line);
    await line.click({ clickCount: 3 });
    await h.wait(500);
    await h.click(page.locator("#group button").nth(2), { pause: 300 });
    await h.wait(1600);
    await h.caption("");
  },

  async "04-salvar"(page, h) {
    await h.openVault();
    await h.caption("");
    await h.click(h.tree("diario"));
    await h.click(h.tree("2026-11-16.md"), { pause: 600 });
    await h.click(page.locator(".ProseMirror > p").last(), { pause: 200 });
    await page.keyboard.press("End");
    await h.press("Enter");
    await h.type("Edição nova, ainda não salva.", 90);
    await h.caption("Para gravar no disco: Arquivo → Salvar Arquivo");
    await h.wait(500);
    await h.click(h.btn("Arquivo"), { pause: 500 });
    await h.click(h.btn("Salvar Arquivo"), { pause: 600 });
    await h.caption("Pronto — o .md original na sua pasta foi atualizado");
    await h.wait(1800);
    console.log("[04] conteúdo salvo:", JSON.stringify(await page.evaluate(async () => {
      const d = await (await navigator.storage.getDirectory()).getDirectoryHandle("meu-vault");
      return (await (await (await d.getDirectoryHandle("diario")).getFileHandle("2026-11-16.md")).getFile()).text();
    })));
    await h.caption("");
  },

  async "05-criar-arquivo-e-pasta"(page, h) {
    await h.openVault();
    await h.caption("Projeto → Nova Pasta");
    await h.click(h.btn("Projeto"), { pause: 500 });
    await h.click(h.btn("Nova Pasta"), { pause: 600 });
    await h.click(page.locator("#entry"), { pause: 200 });
    await h.type("projetos");
    await h.click(h.btn("Salvar"), { pause: 900 });
    await h.caption("Projeto → Novo Arquivo: escolha a pasta de destino e dê um nome");
    await h.click(h.btn("Projeto"), { pause: 500 });
    await h.click(h.btn("Novo Arquivo"), { pause: 700 });
    const modal = page.locator("#entry").locator("xpath=ancestor::div[3]");
    await h.click(modal.getByText("projetos", { exact: true }).first(), { pause: 400 });
    await h.click(page.locator("#entry"), { pause: 200 });
    await h.type("plano.md");
    await h.click(h.btn("Salvar"), { pause: 1600 });
    await h.caption("O arquivo novo já aparece na árvore");
    await h.click(h.tree("projetos"), { pause: 700 });
    await h.click(h.tree("plano.md"), { pause: 700 });
    await h.click(page.locator(".ProseMirror"), { pause: 200 });
    await h.type("# Plano", 110);
    await h.wait(1500);
    await h.caption("");
  },

  async "06-menu-de-contexto"(page, h) {
    await h.openVault();
    await h.caption("Botão direito numa pasta: novo arquivo, nova pasta, renomear, excluir");
    await h.click(h.tree("diario"), { button: "right", pause: 1800 });
    await page.mouse.click(700, 500); await h.wait(500);
    await h.click(h.tree("diario"), { pause: 400 });
    await h.caption("Botão direito num arquivo: renomear ou excluir");
    await h.click(h.tree("2026-11-16.md"), { button: "right", pause: 900 });
    await h.click(h.btn("Renomear arquivo"), { pause: 700 });
    await h.click(page.locator("#entry"), { pause: 200 });
    await page.keyboard.press("Control+A");
    await h.type("hoje.md");
    await h.click(h.btn("Salvar"), { pause: 1000 });
    await h.caption("Excluir pede confirmação num modal");
    await h.click(h.tree("README.md"), { button: "right", pause: 700 });
    await h.click(h.btn("Excluir arquivo"), { pause: 900 });
    await h.click(h.btn("Cancelar"), { pause: 900 });
    await h.caption("");
  },

  async "07-extensoes"(page, h) {
    await h.openVault();
    await h.caption("Uma extensão do vault desenha blocos HTML personalizados dentro da nota");
    await h.click(h.tree("notas"));
    await h.click(h.tree("extensao.md"), { pause: 2200 });
    await h.caption("Projeto → Extensoes abre a pasta .stackeditto com um editor de código");
    await h.click(h.btn("Projeto"), { pause: 500 });
    await h.click(h.btn("Extensoes"), { pause: 900 });
    await h.click(page.getByText("index.js", { exact: true }).last(), { pause: 2600 });
    await h.caption("Edite, clique em Salvar e o workspace recarrega com a extensão nova");
    await h.wait(1500);
    await h.click(h.btn("Fechar"), { pause: 700 });
    await h.caption("");
  },
};

for (const [name, fn] of Object.entries(scenes)) {
  if (only.length && !only.includes(name)) continue;
  try {
    await record(name, OUT, fn, { extra: name === "07-extensoes" ? EXT : undefined });
  } catch (e) { console.log("FAIL", name, e.message.split("\n")[0]); }
}