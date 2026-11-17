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

## Resultados (parciais)

A rodada `--suite react` foi **interrompida em 12 de 36 cenários**: os documentos de 0,6 MB, 2 MB (fixture) e
2 MB (prosa) estão completos, com 3 repetições cada. Faltam listas, tabelas, código, blocos HTML, bloco gigante e
8 MB. Os arquivos brutos estão em [`resultados/`](./resultados/README.md), com React em build de produção e
Chromium 157 headless.

Medianas, em ms, exceto onde indicado:

| documento | variante | abrir | montagem | tecla p50 | tecla p95 | memória (MB) |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| fixture 0,6 MB | app (`full`) | 820 | 160 | 21 | 33 | 235 |
| | EditorView 1.42.3 | 834 | 161 | 29 | 48 | 234 |
| | react-prosemirror | 2.071 | 1.422 | 37 | 63 | 356 |
| | react-prosemirror controlado | 2.096 | 1.473 | 39 | 54 | 357 |
| fixture 2,3 MB | app (`full`) | 2.734 | 591 | 70 | 100 | 402 |
| | EditorView 1.42.3 | 3.035 | 568 | 127 | 182 | 400 |
| | react-prosemirror | **20.330** | **17.511** | 191 | 274 | 887 |
| | react-prosemirror controlado | **21.421** | **18.300** | 194 | 261 | 884 |
| prosa 2,0 MB | app (`full`) | 3.305 | 694 | 90 | 145 | 404 |
| | EditorView 1.42.3 | 3.893 | 607 | 110 | 155 | 404 |
| | react-prosemirror | **13.520** | **10.520** | 178 | 253 | **1.411** |
| | react-prosemirror controlado | **13.086** | **10.282** | 203 | 316 | **1.419** |

O que dá para afirmar até aqui:

- **A montagem é o gargalo.** Parse, criação do state e serialização custam praticamente o mesmo nas quatro
  variantes, porque o código é o mesmo. A diferença está toda em montar o DOM. Com 0,6 MB, o React leva ~9× mais
  que o `EditorView` (1,4 s vs 0,16 s); com 2,3 MB, ~30× (17,5 s vs 0,57 s). O custo cresce mais rápido que o
  tamanho do arquivo: 3,8× mais texto deu 12× mais tempo.
- **Digitação:** o p95 por tecla fica 1,5× a 2× pior que o do `EditorView` na mesma versão. Com 0,6 MB, ainda
  fica perto do orçamento de 50 ms (54–63 ms); com 2 MB, passa de 250 ms.
- **Memória:** 1,5× com 0,6 MB, 2,2× com 2,3 MB e 3,5× com prosa de 2 MB (1,4 GB, acima do orçamento de 1 GB).
  O heap JS vai de 36 para 670 MB por causa das fibras do React, uma por nó.
- **Rolagem e navegação com setas** ficam iguais nas quatro variantes, porque não renderizam nada novo.
- **Controlado vs não controlado:** praticamente igual. Subir o state para o React não é o problema.
- **Os patches do app pesam:** na mesma versão sem patches (1.42.3), o p95 de tecla com 2,3 MB passa de 100 para
  182 ms. Ao trocar de renderizador, esse ganho seria perdido além do custo do React.

### Pontos abertos

- **Corrida de seleção:** uma tecla digitada logo depois de mover o cursor (clique + `End` sem pausa) entra na
  seleção **antiga**. Numa das vezes, substituiu o título inteiro. Com 30 ms de pausa não acontece.
  Reprodução: `testes/space2.cjs`. A comparação sistemática com o editor do app é
  `scripts/pm-perf/react-race.mjs`, escrita mas **ainda não executada**.
- **O save sai diferente:** com o mesmo documento sem edição, o markdown salvo pelo React tem alguns bytes a menos
  que o do `EditorView` (fixture: 471.280 vs 471.297; 2,3 MB: 1.885.123 vs 1.885.191). Na prosa, que não tem
  listas nem tabelas, os dois batem. Falta descobrir qual bloco muda.
- Uma das 3 execuções de `react-controlled` no fixture falhou com "Execution context was destroyed": o Vite
  recarregou a página no meio da execução. É um problema do harness, não da biblioteca.
- Ainda **não verificados**: `npm run react-pm:build` e o `npm run type-check` completo. O
  `tsconfig.react-pm.json` passou sozinho.

### Onde o react-prosemirror tende a ser bom

Os posts da Handle with Care tratam de **integrar ProseMirror com uma UI em React**: node views em componentes
React sem portais, sem *state tearing* entre o React e o EditorView, e menos re-renders do React por tecla dentro
desse modelo. Nada disso é sobre ser mais rápido que o `EditorView` puro, que é o que o Stackeditto usa hoje (e em
Vue). Para este projeto, a troca só compensaria se as extensões (`registerHtmlBlock`) passassem a ser componentes
React. O preço medido é abertura de 9× a 30× mais lenta, teclas 1,5× a 2× mais lentas e muito mais memória em
arquivos grandes.
