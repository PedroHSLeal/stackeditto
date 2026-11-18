# Resultados brutos (react-prosemirror)

Saídas do harness (`npm run perf:pm`), copiadas de `perf-results/` (que é ignorado pelo git). Chromium 157 headless shell,
mesma máquina, uma execução por vez.

| arquivo | o que é |
| --- | --- |
| `01-fixture-react-dev.*` | primeira rodada, fixture de 0,6 MB, 1 repetição — React em build de **desenvolvimento** (descartada: não é justa) |
| `02-fixture-react-prod.*` | mesma rodada com React em build de **produção** |
| `03-suite-react.*` | `--suite react` completa (9 documentos × 4 variantes × 3 repetições), **interrompida em 12/36** a pedido; `.log` é o progresso |
| `05-suite-react-restante.*` | os cenários seguintes (listas e tabelas de 2 MB); interrompida em 5/24 porque tabelas de 2 MB travam no parse compartilhado (timeout nas 3 execuções do `full`, antes de qualquer editor) |
| `06-suite-react-final.*` | tabelas de 0,25 MB, código, blocos HTML e bloco gigante; interrompida em 13/20: o bloco gigante de 2 MB não termina de montar em 5 min nem no editor do app (realce do Shiki num bloco só), então as outras variantes foram puladas |
| `07-suite-react-8mb.*` | fixture de 8 MB |
| `04-corrida-de-selecao.md` | `node scripts/pm-perf/react-race.mjs --trials 15`: tecla logo depois de mover o cursor, 15 tentativas por pausa e editor |

`.md` tem as medianas; `.json` tem todas as amostras de cada execução.
