#!/bin/bash
R=scripts/pm-perf/lab/open-parallel/run.mjs; OUT=perf-results/analysis/open-parallel-raw/matrix32.jsonl
for rep in 1 2; do
  [ $rep = 1 ] && echo "{\"variant\":\"baseline\",\"rep\":$rep,\"r\":$(LAB_WARM=0 node $R baselineMain '["fixture",32]' | tail -1)}" >> $OUT
  for n in 1 2 4 8; do
    echo "{\"variant\":\"N$n\",\"rep\":$rep,\"r\":$(LAB_WARM=0 node $R parallelOpen "[\"fixture\",32,$n,256,{\"mount\":true}]" | tail -1)}" >> $OUT
  done
done
