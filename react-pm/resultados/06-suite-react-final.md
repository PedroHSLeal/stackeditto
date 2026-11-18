# ProseMirror performance run

2026-11-18T13:57:09.938Z · suite `react` · Chromium 157.0.8103.78 headless

Budgets: open (read to first paint) ≤ 1000 · typing p95 ≤ 50 · scroll settle p95 ≤ 100 · blank viewport after settling ≤ 0 · renderer memory ≤ 1024. Over-budget values are in **bold**.

| scenario | status | MB | open ms | parse | state | mount | layout+style | save | reopen | type p50 | type p95 | scroll p95 | blank | arrow walk | renderer MB | JS heap MB | DOM nodes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| full/all/tables@0.25 | ok | 0.2 | **9,053** | 8,780 | 3 | 269 | 172 | error | 7,367 | 23 | 32 | 33 | 0.00 | 40/40 | 226 | 17 | 26,430 |
| full[view-1.42.3]/all/tables@0.25 | ok | 0.2 | **9,388** | 9,144 | 3 | 240 | 148 | error | 7,310 | 22 | 31 | 33 | 0.00 | 40/40 | 225 | 17 | 26,430 |

## Notes

- `full/all/tables@0.25`: save failed: Cannot handle unknown node `table`
- `full[view-1.42.3]/all/tables@0.25`: save failed: Cannot handle unknown node `table`
