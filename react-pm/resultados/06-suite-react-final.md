# ProseMirror performance run

2026-11-18T13:57:09.938Z · suite `react` · Chromium 157.0.8103.78 headless · React production build

Budgets: open (read to first paint) ≤ 1000 · typing p95 ≤ 50 · scroll settle p95 ≤ 100 · blank viewport after settling ≤ 0 · renderer memory ≤ 1024. Over-budget values are in **bold**.

| scenario | status | MB | open ms | parse | state | mount | layout+style | save | reopen | type p50 | type p95 | scroll p95 | blank | arrow walk | renderer MB | JS heap MB | DOM nodes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| full/all/tables@0.25 | ok | 0.2 | **9,053** | 8,780 | 3 | 269 | 172 | error | 7,367 | 23 | 32 | 33 | 0.00 | 40/40 | 226 | 17 | 26,430 |
| full[view-1.42.3]/all/tables@0.25 | ok | 0.2 | **9,388** | 9,144 | 3 | 240 | 148 | error | 7,310 | 22 | 31 | 33 | 0.00 | 40/40 | 225 | 17 | 26,430 |
| react/all/tables@0.25 | ok | 0.2 | **9,888** | 6,920 | 35 | 2,932 | 117 | error | 11,369 | 95 | **130** | 32 | 0.00 | 40/40 | 634 | 265 | 26,434 |
| react-controlled/all/tables@0.25 | ok | 0.2 | **11,116** | 8,380 | 29 | 2,706 | 118 | error | 12,291 | 90 | **117** | 32 | 0.00 | 40/40 | 612 | 265 | 26,434 |
| full/all/fenced@2 | ok | 2.0 | **20,508** | 1,318 | 15,060 | 4,125 | 1,322 | 283 | 16,154 | 810 | **1,015** | 97 | 0.00 | 40/40 | **1,302** | 144 | 871,130 |
| full[view-1.42.3]/all/fenced@2 | ok | 2.0 | **35,126** | 1,428 | 29,059 | 4,633 | 1,428 | 301 | 30,519 | 1,288 | **1,809** | **103** | 0.00 | 40/40 | **1,279** | 143 | 871,130 |
| react/all/fenced@2 | ok | 2.0 | **84,580** | 1,228 | 28,518 | 54,829 | 2,795 | 415 | 109,501 | 1,224 | **1,674** | **106** | 0.00 | 40/40 | **2,673** | 1,160 | 871,134 |
| react-controlled/all/fenced@2 | ok | 2.0 | **83,677** | 1,327 | 28,037 | 54,308 | 2,813 | 401 | 109,236 | 1,243 | **1,772** | **106** | 0.00 | 33/33 | **2,674** | 1,160 | 871,134 |
| full/all/html@2 | ok | 2.0 | **3,556** | 2,671 | 5 | 874 | 562 | 5,781 | 2,731 | 157 | **249** | **156** | 0.00 | 40/40 | 493 | 30 | 124,030 |
| full[view-1.42.3]/all/html@2 | ok | 2.0 | **3,236** | 2,462 | 8 | 761 | 395 | 5,959 | 2,427 | 147 | **262** | **149** | 0.00 | 40/40 | 491 | 30 | 124,030 |
| react/all/html@2 | timeout,timeout,timeout | 2.0 | – | 2,484 | 115 | – | – | – | – | – | – | – | – | – | **1,772** | – | – |
| react-controlled/all/html@2 | timeout,timeout,timeout | 2.0 | – | 2,448 | 122 | – | – | – | – | – | – | – | – | – | **1,770** | – | – |
| full/all/giant-block@2 | timeout,timeout,timeout | 2.0 | – | 589 | 12,621 | – | – | – | – | – | – | – | – | – | 639 | – | – |

## Notes

- `full/all/tables@0.25`: save failed: Cannot handle unknown node `table`
- `full[view-1.42.3]/all/tables@0.25`: save failed: Cannot handle unknown node `table`
- `react/all/tables@0.25`: save failed: Cannot handle unknown node `table`
- `react-controlled/all/tables@0.25`: save failed: Cannot handle unknown node `table`
- `full/all/fenced@2`: saving unedited changes the file: 2,079,790 → 2,079,789 bytes
- `full[view-1.42.3]/all/fenced@2`: saving unedited changes the file: 2,079,790 → 2,079,789 bytes
- `react/all/fenced@2`: saving unedited changes the file: 2,079,790 → 2,079,789 bytes
- `react-controlled/all/fenced@2`: saving unedited changes the file: 2,079,790 → 2,079,789 bytes
- `full/all/html@2`: some keystrokes did not land in the document; saving unedited changes the file: 2,105,520 → 2,155,119 bytes
- `full[view-1.42.3]/all/html@2`: some keystrokes did not land in the document; saving unedited changes the file: 2,105,520 → 2,155,119 bytes
- `react/all/html@2`: failed: __timeout__
- `react-controlled/all/html@2`: failed: __timeout__
- `full/all/giant-block@2`: failed: __timeout__
