# ProseMirror performance run

2026-11-18T15:27:23.858Z · suite `react` · Chromium 157.0.8103.78 headless · React production build

Budgets: open (read to first paint) ≤ 1000 · typing p95 ≤ 50 · scroll settle p95 ≤ 100 · blank viewport after settling ≤ 0 · renderer memory ≤ 1024. Over-budget values are in **bold**.

| scenario | status | MB | open ms | parse | state | mount | layout+style | save | reopen | type p50 | type p95 | scroll p95 | blank | arrow walk | renderer MB | JS heap MB | DOM nodes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| full/all/fixture@8 | ok | 8.0 | **20,805** | 18,371 | 88 | 2,310 | 1,247 | 3,295 | 9,334 | 357 | **502** | **144** | 0.00 | 40/40 | 996 | 69 | 296,970 |
| full[view-1.42.3]/all/fixture@8 | ok | 8.0 | **24,233** | 10,056 | 11,321 | 2,822 | 1,179 | 3,607 | 27,500 | 1,495 | **1,939** | **184** | 0.00 | 40/40 | 834 | 69 | 296,970 |
| react/all/fixture@8 | timeout,timeout,timeout | 8.0 | – | 9,480 | 12,313 | – | – | – | – | – | – | – | – | – | **1,746** | – | – |
| react-controlled/all/fixture@8 | timeout,timeout,timeout | 8.0 | – | 9,724 | 10,153 | – | – | – | – | – | – | – | – | – | **1,755** | – | – |

## Notes

- `full/all/fixture@8`: saving unedited changes the file: 8,375,108 → 6,598,171 bytes
- `full[view-1.42.3]/all/fixture@8`: saving unedited changes the file: 8,375,108 → 6,598,171 bytes
- `react/all/fixture@8`: failed: __timeout__
- `react-controlled/all/fixture@8`: failed: __timeout__
