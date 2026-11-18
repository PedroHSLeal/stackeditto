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

## Resultados

`npm run perf:pm -- --suite react`, React em build de produção, Chromium 157 headless shell, 3 execuções por
cenário (medianas) e limite de 5 min por execução. A suíte rodou em quatro partes; os arquivos brutos estão em
[`resultados/`](./resultados/README.md) (01 a 07).

Em ms, exceto memória. "abrir" vai da leitura do arquivo até o primeiro frame pintado; "montar" é só criar o DOM
do editor; "memória" é o processo de renderização inteiro.

| documento | variante | abrir | montar | tecla p50 | tecla p95 | memória (MB) |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| fixture 0,6 MB | app (`full`) | 820 | 160 | 21 | 33 | 235 |
| | EditorView 1.42.3 | 834 | 161 | 29 | 48 | 234 |
| | react-prosemirror | 2.071 | 1.422 | 37 | 63 | 356 |
| | react-prosemirror controlado | 2.096 | 1.473 | 39 | 54 | 357 |
| tabelas 0,25 MB | app (`full`) | 9.053 | 269 | 23 | 32 | 226 |
| | EditorView 1.42.3 | 9.388 | 240 | 22 | 31 | 225 |
| | react-prosemirror | 9.888 | 2.932 | 95 | **130** | 634 |
| | react-prosemirror controlado | 11.116 | 2.706 | 90 | **117** | 612 |
| fixture 2,3 MB | app (`full`) | 2.734 | 591 | 70 | 100 | 402 |
| | EditorView 1.42.3 | 3.035 | 568 | 127 | 182 | 400 |
| | react-prosemirror | **20.330** | **17.511** | 191 | 274 | 887 |
| | react-prosemirror controlado | **21.421** | **18.300** | 194 | 261 | 884 |
| prosa 2,0 MB | app (`full`) | 3.305 | 694 | 90 | 145 | 404 |
| | EditorView 1.42.3 | 3.893 | 607 | 110 | 155 | 404 |
| | react-prosemirror | **13.520** | **10.520** | 178 | 253 | **1.411** |
| | react-prosemirror controlado | **13.086** | **10.282** | 203 | 316 | **1.419** |
| listas 2,1 MB | app (`full`) | 5.446 | 836 | 114 | 155 | 592 |
| | EditorView 1.42.3 | 5.936 | 1.045 | 113 | 173 | 594 |
| | react-prosemirror (1 de 3 estourou o limite) | **117.626** | **112.743** | 322 | 417 | **1.945** |
| | react-prosemirror controlado | **114.535** | **109.726** | 353 | 486 | **1.947** |
| código 2,0 MB | app (`full`) | 20.508 | 4.125 | 810 | 1.015 | 1.302 |
| | EditorView 1.42.3 | 35.126 | 4.633 | 1.288 | 1.809 | 1.279 |
| | react-prosemirror | **84.580** | **54.829** | 1.224 | 1.674 | **2.673** |
| | react-prosemirror controlado | **83.677** | **54.308** | 1.243 | 1.772 | **2.674** |
| blocos HTML 2,0 MB | app (`full`) | 3.556 | 874 | 157 | 249 | 493 |
| | EditorView 1.42.3 | 3.236 | 761 | 147 | 262 | 491 |
| | react-prosemirror | **não abre** (> 5 min nas 3) | – | – | – | **1.772** |
| | react-prosemirror controlado | **não abre** (> 5 min nas 3) | – | – | – | **1.770** |
| fixture 8 MB | app (`full`) | 20.805 | 2.310 | 357 | 502 | 996 |
| | EditorView 1.42.3 | 24.233 | 2.822 | 1.495 | 1.939 | 834 |
| | react-prosemirror | **não abre** (> 5 min nas 3) | – | – | – | **1.746** |
| | react-prosemirror controlado | **não abre** (> 5 min nas 3) | – | – | – | **1.755** |

Fora da comparação: **tabelas de 2 MB** travam no parse markdown (código compartilhado) e **um bloco de código
único de 2 MB** não termina de montar nem no editor do app. Os dois estouraram o limite nas 3 execuções do `full`,
e as outras variantes foram puladas. Esses são problemas do app hoje, independentes do renderizador.

### Conclusões

- **Não há nenhum caso medido em que o react-prosemirror seja mais rápido.** Na melhor situação (código, em que
  o realce do Shiki domina tudo) ele empata na digitação com o `EditorView` na mesma versão. Em todos os outros
  casos ele fica atrás, e em arquivos grandes fica muito atrás.
- **O gargalo é a montagem.** Parse, state e serialização são o mesmo código e custam o mesmo. Montar o documento
  com React custa, em relação ao `EditorView` 1.42.3: **9×** com 0,6 MB, **12×** em tabelas pequenas e em código,
  **17×** em prosa, **31×** no fixture de 2,3 MB, **108×** em listas e **mais de 100×** no fixture de 8 MB. Com
  blocos HTML de extensão a montagem passa de 5 minutos, contra 0,76 s. O custo cresce mais rápido que o tamanho
  e explode em estruturas aninhadas (listas) e com node views clássicos (blocos HTML).
- **Os blocos HTML são o pior caso, e são o recurso central das extensões.** No react-prosemirror, o
  `HtmlBlockView` entra como `NodeViewConstructor` clássico pela prop `nodeViews`. A hipótese, ainda não
  verificada, é que esse caminho de compatibilidade tenha um custo alto por instância. Reescrever o node view como
  componente React (`nodeViewComponents`) seria o próximo teste.
- **Digitação:** p95 de 1,5× a 4× pior (tabelas pequenas: 130 vs 31 ms), exceto em código.
- **Memória:** 1,5× a 3,5× maior, até 2,7 GB. O heap JS passa de 30–150 MB para 0,3–1,2 GB, porque o React guarda
  uma fibra por nó do documento.
- **Rolagem e navegação com setas** ficam iguais nas quatro variantes.
- **Controlado vs não controlado** dá resultados praticamente iguais. Subir o state para o React não é o
  problema; o custo está na renderização do documento.
- **Os patches de `patches/` são importantes.** Sem eles, o mesmo `EditorView` na 1.42.3 digita até 4× pior no
  fixture de 8 MB (p95 1.939 vs 502 ms) e abre código 1,7× mais devagar. Uma troca para o react-prosemirror
  perderia esses ganhos, porque a biblioteca fixa a 1.42.3, e somaria o custo do React.

### Pontos abertos

- **Corrida de seleção (confirmada):** uma tecla digitada logo depois de mover o cursor nativamente entra na
  seleção **antiga**. Resultado de `scripts/pm-perf/react-race.mjs --trials 15`
  ([resultados/04-corrida-de-selecao.md](./resultados/04-corrida-de-selecao.md)), em acertos por pausa entre
  mover o cursor e digitar:

  | editor | sequência | 0 ms | 10 ms | 30 ms | 100 ms |
  | --- | --- | ---: | ---: | ---: | ---: |
  | app (1.41.0 + patches) | clique + End + digitar | 15/15 | 15/15 | 15/15 | 15/15 |
  | app (1.41.0 + patches) | End + ↓ + digitar | 15/15 | 15/15 | 15/15 | 15/15 |
  | EditorView 1.42.3 | os dois | 15/15 | 15/15 | 15/15 | 15/15 |
  | react-prosemirror | clique + End + digitar | **12/15** | 15/15 | 15/15 | 15/15 |
  | react-prosemirror | End + ↓ + digitar | **13/15** | 15/15 | 15/15 | 15/15 |
  | react-prosemirror controlado | clique + End + digitar | **9/15** | **13/15** | 15/15 | 15/15 |
  | react-prosemirror controlado | End + ↓ + digitar | **13/15** | 15/15 | 15/15 | 15/15 |

  Os erros não são só de posição: várias vezes o título inteiro foi **substituído** pelo texto digitado
  (`"XYXYXY" → "XY"`), o que é perda de conteúdo. O `EditorView` relê a seleção do DOM antes de tratar a
  digitação; pelo comportamento, o react-prosemirror usa a seleção do state, que só é atualizada no próximo
  `selectionchange`. Uma pessoa raramente digita menos de 10–30 ms depois de um clique, mas atalhos, macros de
  teclado e testes automatizados fazem isso.
- **O save sai diferente:** com o mesmo documento sem edição, o markdown salvo pelo React tem alguns bytes a menos
  que o do `EditorView` (fixture: 471.280 vs 471.297; 2,3 MB: 1.885.123 vs 1.885.191). Na prosa, que não tem
  listas nem tabelas, os dois batem. Falta descobrir qual bloco muda.
- Uma das 3 execuções de `react-controlled` no fixture falhou com "Execution context was destroyed": o Vite
  recarregou a página no meio da execução. É um problema do harness, não da biblioteca.
- Salvar o arquivo de tabelas falha nas 4 variantes ("Cannot handle unknown node `table`"): o serializador
  markdown do app não exporta tabelas. É um bug que já existia, registrado em `docs/code-review.md`.
- Verificado: o `npm run react-pm:build` gera o build e o preview funciona (abrir, bloco HTML, digitar, Ctrl+S).
  O `npm run type-check` acusa só os erros que já existiam antes desta branch (`App.vue`, `ExtensionModal.vue`,
  playground e o `lib` do `@tsconfig/node22`); nada em `react-pm/` nem no `tsconfig.react-pm.json`.

### Onde o react-prosemirror tende a ser bom

Os posts da Handle with Care tratam de **integrar ProseMirror com uma UI em React**: node views em componentes
React sem portais, sem *state tearing* entre o React e o EditorView, e menos re-renders do React por tecla dentro
desse modelo. Nada disso é sobre ser mais rápido que o `EditorView` puro, que é o que o Stackeditto usa hoje (e em
Vue).

Para o Stackeditto, ele faria sentido se o app migrasse para React e quisesse extensões escritas como componentes
React, aceitando arquivos pequenos (bem abaixo de 0,6 MB) como limite. Para o objetivo de performance, os números
apontam o contrário: as melhorias continuam no caminho que o projeto já segue, com patches no prosemirror-view,
windowing (`pm-window`), realce incremental e o parse de tabelas.

### Próximos testes possíveis

1. Reescrever o `HtmlBlockView` como `nodeViewComponents` e repetir `html@2`, para saber se o problema é o caminho
   de compatibilidade dos node views clássicos.
2. Medir documentos pequenos (10–100 KB), que são o caso comum de notas, para saber se a diferença é perceptível.
3. Descobrir por que o save do React sai alguns bytes diferente no fixture.
4. Reportar a corrida de seleção no repositório da biblioteca, com o `react-race.mjs` como reprodução.
