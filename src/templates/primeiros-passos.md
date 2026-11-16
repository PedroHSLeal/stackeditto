# Primeiros passos

O Stackeditto é um editor de markdown que roda inteiro no navegador. Você escolhe uma pasta do seu computador e ela vira o seu **workspace**: o app lê e grava os arquivos dessa pasta diretamente, sem servidor, sem conta e sem upload.

> Use Chrome, Edge ou outro navegador baseado em Chromium. Firefox e Safari não permitem que páginas abram pastas locais.

## 1. Abrir uma pasta

Na tela inicial, clique em **Workspace**. O navegador abre o seletor de pastas e pede permissão de leitura e escrita: escolha a pasta das suas notas e confirme. A árvore de arquivos aparece na lateral.

![Abrindo um workspace](gifs/01-abrir-workspace.gif)

- Clique numa **pasta** para expandir ou recolher.
- Clique num **arquivo** para abrir no editor.
- As pastas `.git` e `.obsidian` são ignoradas, então dá para abrir um vault do Obsidian.

## 2. Navegar entre arquivos

![Navegando entre arquivos](gifs/02-navegar-arquivos.gif)

- **Arquivos abertos**: tudo o que você abre entra nessa lista, no topo da lateral. Ao trocar de arquivo, as edições ainda não salvas ficam guardadas e voltam quando você reabre o arquivo pela lista.
- **Arquivos `.md`** abrem no editor visual: você vê o texto já formatado.
- **Outros arquivos** (`.json`, `.js`, ...) abrem num editor de código, o mesmo do VS Code.
- O botão **☰** no canto superior esquerdo esconde e mostra a lateral.

## 3. Escrever

O editor transforma a sintaxe de markdown em formatação enquanto você digita. Digite o atalho no **começo de uma linha**:

![Escrevendo com atalhos de markdown](gifs/03-escrever-markdown.gif)

| Digite no início da linha | Resultado |
| --- | --- |
| `# ` até `###### ` | Título de nível 1 a 6 |
| `1. ` | Lista numerada |
| `- `, `* ` ou `+ ` | Lista com marcadores |
| `> ` | Citação |
| três crases | Bloco de código |
| `-- ` (dois hífens e espaço) | Linha horizontal |
| `[texto](url) ` | Link |
| `![alt](url) ` | Imagem |

A **barra no topo do editor** tem botões de **H1 a H6** e de listas. Para transformar uma linha em título, selecione a linha e clique no nível desejado.

## 4. Salvar

As edições ficam na memória até você salvar. Para gravar no arquivo: **Arquivo → Salvar Arquivo**.

![Salvando um arquivo](gifs/04-salvar.gif)

Não existe salvamento automático nem `Ctrl+S` no editor de markdown. Se você recarregar a página antes de salvar, as edições se perdem.

## 5. Criar pastas e arquivos

Pelo menu **Projeto**:

- **Nova Pasta**: digite o nome e clique em **Salvar**.
- **Novo Arquivo**: clique na pasta de destino dentro da janela (sem escolher, o arquivo vai para a raiz), digite o nome com a extensão, como `plano.md`, e clique em **Salvar**.

![Criando uma pasta e um arquivo](gifs/05-criar-arquivo-e-pasta.gif)

**Projeto → Recarregar Workspace** relê a pasta do disco, útil quando você mexeu nos arquivos por fora do app.

## 6. Renomear e excluir

Clique com o **botão direito** num item da árvore:

- **Pasta**: novo arquivo, nova pasta, renomear, excluir.
- **Arquivo**: renomear, excluir.

![Renomeando e excluindo pelo botão direito](gifs/06-menu-de-contexto.gif)

Excluir sempre pede confirmação antes de apagar do disco.

## 7. Extensões

Cada workspace pode ter extensões em JavaScript, guardadas na pasta oculta `.stackeditto` dentro dele. Uma extensão registra uma **tag HTML personalizada**, e o editor desenha essa tag dentro das suas notas usando o código da extensão.

![Extensões](gifs/07-extensoes.gif)

**Projeto → Extensoes** abre o gerenciador, com os arquivos da extensão e um editor de código. Depois de editar, clique em **Salvar** (ou `Ctrl+S`) e o workspace recarrega com a extensão atualizada. Na primeira vez, o app cria a pasta e um arquivo de exemplo.

Exemplo de extensão, em `.stackeditto/index.js`:

```js
registerHtmlBlock({
  htmlTag: "cartao-aviso",
  init: (element, content) => {
    element.textContent = "💡 " + (content || "").trim();
  },
  toMarkdown: (container, element) => element.textContent.replace("💡 ", ""),
  toHtml: () => { },
});
```

E a nota usa a tag assim, com a abertura e o fechamento **em linhas próprias**:

```markdown
<cartao-aviso>
Este cartão foi desenhado por uma extensão.
</cartao-aviso>
```

> **Atenção:** extensões rodam sem isolamento e têm acesso à pasta que você abriu. Só abra workspaces com extensões em que você confia.

## Cuidados

Algumas coisas ainda não funcionam bem:

- **Código inline** (texto entre crases no meio de uma frase) some ao abrir o arquivo, e é perdido se você salvar.
- O atalho `**negrito** ` digitado só funciona no primeiro parágrafo do documento.
- O botão de título da barra, sem nada selecionado, engole o primeiro caractere digitado.
- Edições em arquivos que não são `.md` não são salvas.
- O botão **Tour** da tela inicial ainda não faz nada.