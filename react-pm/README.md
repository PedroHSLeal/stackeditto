# react-pm — experimento com @handlewithcare/react-prosemirror

Branch `react-prosemirror`. Hipótese a testar: trocar o `EditorView` do prosemirror-view pelo
[@handlewithcare/react-prosemirror](https://github.com/handlewithcarecollective/react-prosemirror)
(o renderizador de ProseMirror em React da Handle with Care, posts
["Why I rebuilt ProseMirror's renderer in React"](https://discuss.prosemirror.net/t/smoores-dev-why-i-rebuilt-prosemirror-s-renderer-in-react/8191) e
["Making React ProseMirror really, really fast"](https://discuss.prosemirror.net/t/making-react-prosemirror-really-really-fast/8980))
melhora a performance do editor do Stackeditto.

Este diretório é um **app React separado**, mais simples que o app Vue, mas com as mesmas funções
principais. O app Vue em `src/` continua igual.

## Como rodar

```bash
npm install
npm run react-pm          # dev server em http://localhost:5173/ (React em modo development)
npm run react-pm:build    # build de produção em dist-react-pm/ (é o que vale para sentir a performance)
npm run react-pm:preview  # serve o build em http://localhost:4173/stackeditto/react-pm/
```

- **Abrir pasta**: File System Access API (Chrome/Edge), igual ao app.
- **Workspace demo**: workspace em memória com um arquivo por tipo de bloco e arquivos grandes
  (`grandes/huge-file-x8.md` tem ~4,8 MB). Usa o backend `inMemory` do app, com as mesmas lacunas
  (criar arquivo/pasta não aparece na árvore — ver `docs/in-memory-fs-diagnosis.md`).
- A barra de baixo mostra, ao vivo, parse, criação do state, montagem, serialização e a latência das teclas.

> Em `npm run react-pm` o React roda o build de **desenvolvimento**, várias vezes mais lento. Para comparar
> performance use o build (`react-pm:build`) ou o harness abaixo, que força o build de produção do React.

## O que foi reaproveitado

Nada de arquivo, árvore, markdown ou extensão foi reescrito para o React — o módulo importa `src/` direto.

| peça | origem | reaproveitada? |
| --- | --- | --- |
| backends de arquivos (`physical` / `inMemory`) | `src/services/file-system` | sim, `useFileSystem` |
| CRUD, árvore, busca por caminho | `src/services/file-system/utils` | sim, `useFileSystemManipulation` |
| markdown → ProseMirror e volta | `src/services/markdown/remark` | sim |
| schema, input rules, keymaps, cursores, Shiki | `src/services/prosemirror` | sim, `defaultPlugins` (+ `reactKeys()`) |
| node view de bloco HTML das extensões | `src/services/prosemirror/node-views/html-block.ts` | sim, como `NodeViewConstructor` clássico pela prop `nodeViews` |
| salvar (`getProsemirrorText`, com os hooks `toMarkdown` das extensões) | `src/services/prosemirror` | sim, recebe a view do React |
| ações do menu (H1–H6, listas) | `src/models/top-menu.ts` | sim (rótulos em texto no lugar dos ícones Iconify) |
| extensões `.stackeditto` (scripts e módulos) | `src/services/untrusted-code-extensions` | sim |
| estilos do documento | `src/components/editors/prosemirror/prosemirror.scss` | sim (extraído do `Editor.vue`) |
| cache de edições não salvas | `src/services/opened-files` | não — depende de `shallowRef` do Vue; virou um `Map` num `useRef` |
| árvore, modais, editor de extensões | componentes `.vue` | reescritos de forma simples (prompt/confirm, textarea) |
| Monaco para arquivos que não são `.md` | `src/components/editors/monaco` | não — um `<textarea>` |

Mudanças em `src/` para permitir o reaproveitamento (o app Vue se comporta igual):

- `services/prosemirror/index.ts`: a lista de plugins virou `export const defaultPlugins`, e `setDefaultView(view)`
  deixa `executeCommand`/`getProsemirrorText` sem argumento usarem uma view que não nasceu em `buildProsemirrorView`.
- `node-views/html-block.ts`: `dom: HTMLElement` (a 1.42.3 tipa `NodeView.dom` como `HTMLElement`).
- `Editor.vue`: o CSS global do documento foi para `prosemirror.scss`, importado pelos dois apps.

## Dependências: duas versões do prosemirror-view

O react-prosemirror estende o `EditorView` por dentro e exige **prosemirror-view 1.42.3 exato**. O app usa a
1.41.0 com os patches de performance de `patches/`. Para não mexer no app:

- a 1.42.3 está instalada com o nome `prosemirror-view-react` (`npm:prosemirror-view@1.42.3`);
- `overrides` no `package.json` faz o peer dependency da lib aceitar a versão do app (senão o `npm ci` falha);
- os modos `react-pm` e `playground-react` do `vite.config.ts` apontam **todo** `prosemirror-view` do bundle
  (inclusive os imports de `src/`) para a 1.42.3, com cache de pré-bundle próprio;
- `tsconfig.react-pm.json` faz o mesmo para os tipos.

Consequência: o lado React roda **sem os patches** de `patches/prosemirror-view+1.41.0.patch`. Por isso o harness
compara também o `EditorView` puro na 1.42.3, que é a comparação justa da troca de renderizador.

## Como medir

```bash
# o harness de sempre, com as 4 variantes em 9 documentos (≈ 1 h; --only para filtrar)
npm run perf:pm -- --suite react
npm run perf:pm -- --suite react-full          # + 32 MB
# a corrida de seleção (tecla logo depois de mover o cursor)
node scripts/pm-perf/react-race.mjs
```

Se o navegador do Playwright desta versão não estiver instalado, passe `--executable <binário>` ou
`PM_PERF_CHROMIUM=<binário>`.

| variante | o que é |
| --- | --- |
| `full` | o editor do app hoje: prosemirror-view 1.41.0 + patches |
| `full[view-1.42.3]` | o mesmo `EditorView` puro, na 1.42.3 sem patches |
| `react` | react-prosemirror não controlado (`defaultState`), como neste módulo |
| `react-controlled` | react-prosemirror controlado (`state` num `useState` do pai) |

Todas usam o mesmo parser, schema, plugins (`all`) e node view de bloco HTML.

<!-- RESULTADOS -->
