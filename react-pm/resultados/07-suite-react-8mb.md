# ProseMirror performance run

2026-11-18T15:27:23.858Z · suite `react` · Chromium 157.0.8103.78 headless

Budgets: open (read to first paint) ≤ 1000 · typing p95 ≤ 50 · scroll settle p95 ≤ 100 · blank viewport after settling ≤ 0 · renderer memory ≤ 1024. Over-budget values are in **bold**.

| scenario | status | MB | open ms | parse | state | mount | layout+style | save | reopen | type p50 | type p95 | scroll p95 | blank | arrow walk | renderer MB | JS heap MB | DOM nodes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| full/all/fixture@8 | ok | 8.0 | **20,805** | 18,371 | 88 | 2,310 | 1,247 | 3,295 | 9,334 | 357 | **502** | **144** | 0.00 | 40/40 | 996 | 69 | 296,970 |

## Notes

- `full/all/fixture@8`: saving unedited changes the file: 8,375,108 → 6,598,171 bytes
