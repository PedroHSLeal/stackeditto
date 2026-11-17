# ProseMirror performance run

2026-11-17T22:50:12.979Z · suite `react` · Chromium 157.0.8103.78 headless · React production build

Budgets: open (read to first paint) ≤ 1000 · typing p95 ≤ 50 · scroll settle p95 ≤ 100 · blank viewport after settling ≤ 0 · renderer memory ≤ 1024. Over-budget values are in **bold**.

| scenario | status | MB | open ms | parse | state | mount | layout+style | save | reopen | type p50 | type p95 | scroll p95 | blank | arrow walk | renderer MB | JS heap MB | DOM nodes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| full/all/fixture@fixture | ok | 0.6 | 710 | 544 | 11 | 152 | 63 | 71 | 556 | 19 | 42 | 32 | 0.00 | 40/40 | 234 | 15 | 21,175 |
| full[view-1.42.3]/all/fixture@fixture | ok | 0.6 | 793 | 618 | 34 | 138 | 62 | 71 | 692 | 25 | 40 | 33 | 0.00 | 40/40 | 236 | 15 | 21,175 |
| react/all/fixture@fixture | ok | 0.6 | **2,069** | 613 | 43 | 1,410 | 108 | 76 | 1,976 | 39 | **58** | 32 | 0.00 | 40/40 | 357 | 88 | 21,195 |
| react-controlled/all/fixture@fixture | ok | 0.6 | **2,436** | 817 | 47 | 1,569 | 69 | 73 | 2,878 | 43 | **59** | 31 | 0.00 | 40/40 | 357 | 88 | 21,205 |

## Notes

- `full/all/fixture@fixture`: saving unedited changes the file: 598,222 → 471,297 bytes
- `full[view-1.42.3]/all/fixture@fixture`: saving unedited changes the file: 598,222 → 471,297 bytes
- `react/all/fixture@fixture`: saving unedited changes the file: 598,222 → 471,280 bytes
- `react-controlled/all/fixture@fixture`: saving unedited changes the file: 598,222 → 471,280 bytes
