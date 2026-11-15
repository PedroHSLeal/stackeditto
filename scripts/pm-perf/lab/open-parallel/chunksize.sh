#!/bin/bash
R=scripts/pm-perf/lab/open-parallel/run.mjs; OUT=perf-results/analysis/open-parallel-raw/chunksize.jsonl
for rep in 1 2 3; do
  for kb in 32 128 512 2048 8192; do
    echo "{\"variant\":\"kb$kb\",\"rep\":$rep,\"r\":$(LAB_WARM=0 node $R parallelOpen "[\"fixture\",8,4,$kb]" | tail -1)}" >> $OUT
  done
done
