# Resultados brutos (react-prosemirror)

Saídas do harness (`npm run perf:pm`), copiadas de `perf-results/` (que é ignorado pelo git). Chromium 157 headless shell,
mesma máquina, uma execução por vez.

| arquivo | o que é |
| --- | --- |
| `01-fixture-react-dev.*` | primeira rodada, fixture de 0,6 MB, 1 repetição — React em build de **desenvolvimento** (descartada: não é justa) |
| `02-fixture-react-prod.*` | mesma rodada com React em build de **produção** |
| `03-suite-react.*` | `--suite react` completa (9 documentos × 4 variantes × 3 repetições); `.log` é o progresso. Enquanto a rodada não termina, os arquivos são parciais e são atualizados a cada commit |

`.md` tem as medianas; `.json` tem todas as amostras de cada execução.
