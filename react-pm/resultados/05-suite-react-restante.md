# ProseMirror performance run

2026-11-18T13:10:01.769Z · suite `react` · Chromium 157.0.8103.78 headless

Budgets: open (read to first paint) ≤ 1000 · typing p95 ≤ 50 · scroll settle p95 ≤ 100 · blank viewport after settling ≤ 0 · renderer memory ≤ 1024. Over-budget values are in **bold**.

| scenario | status | MB | open ms | parse | state | mount | layout+style | save | reopen | type p50 | type p95 | scroll p95 | blank | arrow walk | renderer MB | JS heap MB | DOM nodes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| full/all/lists@2 | ok | 2.1 | **5,446** | 4,600 | 5 | 836 | 572 | 1,424 | 4,666 | 114 | **155** | **114** | 0.00 | 40/40 | 592 | 31 | 112,031 |

## Notes

- `full/all/lists@2`: saving unedited changes the file: 2,171,400 → 2,252,599 bytes
