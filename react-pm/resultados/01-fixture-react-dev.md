# ProseMirror performance run

2026-11-17T22:48:32.707Z · suite `react` · Chromium 157.0.8103.78 headless

Budgets: open (read to first paint) ≤ 1000 · typing p95 ≤ 50 · scroll settle p95 ≤ 100 · blank viewport after settling ≤ 0 · renderer memory ≤ 1024. Over-budget values are in **bold**.

| scenario | status | MB | open ms | parse | state | mount | layout+style | save | reopen | type p50 | type p95 | scroll p95 | blank | arrow walk | renderer MB | JS heap MB | DOM nodes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| full/all/fixture@fixture | ok | 0.6 | 885 | 717 | 12 | 153 | 67 | 85 | 580 | 30 | 42 | 30 | 0.00 | 40/40 | 236 | 15 | 21,175 |
| full[view-1.42.3]/all/fixture@fixture | ok | 0.6 | 977 | 745 | 48 | 181 | 71 | 103 | 938 | 29 | 35 | 31 | 0.00 | 40/40 | 235 | 15 | 21,175 |
| react/all/fixture@fixture | ok | 0.6 | **3,517** | 678 | 42 | 2,794 | 118 | 68 | 3,906 | 64 | **116** | 32 | 0.00 | 40/40 | 494 | 135 | 21,210 |
| react-controlled/all/fixture@fixture | ok | 0.6 | **2,942** | 554 | 40 | 2,346 | 63 | 81 | 3,162 | 71 | **163** | 31 | 0.00 | 40/40 | 454 | 135 | 21,200 |

## Notes

- `full/all/fixture@fixture`: saving unedited changes the file: 598,222 → 471,297 bytes
- `full[view-1.42.3]/all/fixture@fixture`: saving unedited changes the file: 598,222 → 471,297 bytes
- `react/all/fixture@fixture`: saving unedited changes the file: 598,222 → 471,280 bytes
- `react-controlled/all/fixture@fixture`: saving unedited changes the file: 598,222 → 471,280 bytes
