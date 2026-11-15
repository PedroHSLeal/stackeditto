#!/bin/bash
# interleaved ABAB runs at 8 MB: baseline(main) vs chunked N=1,2,4,8
R=scripts/pm-perf/lab/open-parallel/run.mjs; OUT=perf-results/analysis/open-parallel-raw/matrix8.jsonl
for rep in 1 2 3; do
  echo "{\"variant\":\"baseline\",\"rep\":$rep,\"r\":$(LAB_WARM=0 node $R baselineMain '["fixture",8]' | tail -1)}" >> $OUT
  for n in 1 2 4 8; do
    echo "{\"variant\":\"N$n\",\"rep\":$rep,\"r\":$(LAB_WARM=0 node $R parallelOpen "[\"fixture\",8,$n,256,{\"mount\":true}]" | tail -1)}" >> $OUT
  done
done
