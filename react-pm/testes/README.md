# Testes manuais com Playwright (react-pm)

Scripts usados para validar o módulo e para achar a corrida de seleção. Esperam o dev server em
`http://localhost:5280/` (`npx vite --mode react-pm --port 5280`) e usam o Playwright instalado globalmente.

| script | o que faz |
| --- | --- |
| `smoke.cjs` | percorre o workspace demo: abre arquivos, digita, input rule, bloco HTML da extensão, troca de arquivo mantendo a edição, Ctrl+S, Shiki, tabelas, arquivo grande, e lista erros do console |
| `caret.cjs` | clique + End + digitação com pausas de 0/50/300 ms |
| `space.cjs` | digitação com espaços em velocidades diferentes |
| `space2.cjs` | reproduz o bug: clique + End + digitação **sem pausa** insere na seleção antiga (e chegou a substituir o título inteiro) |

A versão sistemática do teste da corrida, comparando com o editor do app, é `scripts/pm-perf/react-race.mjs`.
