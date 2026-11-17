# ProseMirror performance run

2026-11-17T22:51:12.461Z · suite `react` · Chromium 157.0.8103.78 headless · React production build

Budgets: open (read to first paint) ≤ 1000 · typing p95 ≤ 50 · scroll settle p95 ≤ 100 · blank viewport after settling ≤ 0 · renderer memory ≤ 1024. Over-budget values are in **bold**.

| scenario | status | MB | open ms | parse | state | mount | layout+style | save | reopen | type p50 | type p95 | scroll p95 | blank | arrow walk | renderer MB | JS heap MB | DOM nodes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| full/all/fixture@fixture | ok | 0.6 | 820 | 642 | 15 | 160 | 74 | 75 | 647 | 21 | 33 | 33 | 0.00 | 40/40 | 235 | 15 | 21,175 |
| full[view-1.42.3]/all/fixture@fixture | ok | 0.6 | 834 | 635 | 35 | 161 | 72 | 77 | 735 | 29 | 48 | 32 | 0.00 | 40/40 | 234 | 15 | 21,175 |
| react/all/fixture@fixture | ok | 0.6 | **2,071** | 587 | 59 | 1,422 | 71 | 73 | 2,086 | 37 | **63** | 32 | 0.00 | 40/40 | 356 | 88 | 21,180 |
| react-controlled/all/fixture@fixture | ok,error,ok | 0.6 | **2,096** | 581 | 40 | 1,473 | 71 | 71 | 2,048 | 39 | **54** | 33 | 0.00 | 40/40 | 357 | 88 | 21,195 |
| full/all/fixture@2 | ok | 2.3 | **2,734** | 2,103 | 31 | 591 | 319 | 268 | 1,952 | 70 | **100** | 30 | 0.00 | 40/40 | 402 | 27 | 84,690 |
| full[view-1.42.3]/all/fixture@2 | ok | 2.3 | **3,035** | 2,002 | 456 | 568 | 292 | 303 | 2,786 | 127 | **182** | 33 | 0.00 | 40/40 | 400 | 27 | 84,610 |
| react/all/fixture@2 | ok | 2.3 | **20,330** | 2,346 | 464 | 17,511 | 281 | 310 | 20,341 | 191 | **274** | 33 | 0.00 | 40/40 | 887 | 316 | 84,878 |
| react-controlled/all/fixture@2 | ok | 2.3 | **21,421** | 2,474 | 638 | 18,300 | 283 | 322 | 20,396 | 194 | **261** | 34 | 0.00 | 40/40 | 884 | 316 | 84,878 |
| full/all/prose@2 | ok | 2.0 | **3,305** | 2,605 | 1 | 694 | 369 | 572 | 2,712 | 90 | **145** | 64 | 0.00 | 40/40 | 404 | 36 | 125,790 |
| full[view-1.42.3]/all/prose@2 | ok | 2.0 | **3,893** | 3,279 | 2 | 607 | 315 | 688 | 3,098 | 110 | **155** | 45 | 0.00 | 40/40 | 404 | 36 | 125,790 |
| react/all/prose@2 | ok | 2.0 | **13,520** | 2,928 | 66 | 10,520 | 300 | 701 | 15,538 | 178 | **253** | 32 | 0.00 | 40/40 | **1,411** | 670 | 125,794 |
| react-controlled/all/prose@2 | ok | 2.0 | **13,086** | 2,735 | 65 | 10,282 | 247 | 709 | 14,688 | 203 | **316** | 38 | 0.00 | 40/40 | **1,419** | 670 | 125,794 |

## Notes

- `full/all/fixture@fixture`: saving unedited changes the file: 598,222 → 471,297 bytes
- `full[view-1.42.3]/all/fixture@fixture`: saving unedited changes the file: 598,222 → 471,297 bytes
- `react/all/fixture@fixture`: saving unedited changes the file: 598,222 → 471,280 bytes
- `react-controlled/all/fixture@fixture`: failed: page.evaluate: Execution context was destroyed, most likely because of a navigation.; saving unedited changes the file: 598,222 → 471,280 bytes
- `full/all/fixture@2`: saving unedited changes the file: 2,392,888 → 1,885,191 bytes
- `full[view-1.42.3]/all/fixture@2`: saving unedited changes the file: 2,392,888 → 1,885,191 bytes
- `react/all/fixture@2`: saving unedited changes the file: 2,392,888 → 1,885,123 bytes
- `react-controlled/all/fixture@2`: saving unedited changes the file: 2,392,888 → 1,885,123 bytes
- `full/all/prose@2`: saving unedited changes the file: 2,120,448 → 1,958,207 bytes
- `full[view-1.42.3]/all/prose@2`: saving unedited changes the file: 2,120,448 → 1,958,207 bytes
- `react/all/prose@2`: saving unedited changes the file: 2,120,448 → 1,958,207 bytes
- `react-controlled/all/prose@2`: saving unedited changes the file: 2,120,448 → 1,958,207 bytes
