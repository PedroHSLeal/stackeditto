#!/bin/bash
R=scripts/pm-perf/lab/open-parallel/run.mjs; OUT=perf-results/analysis/open-parallel-raw/prog.jsonl
run() { echo "{\"variant\":\"$1\",\"rep\":$2,\"r\":$(LAB_WARM=0 node $R progressiveOpen "$3" | tail -1)}" >> $OUT; }
for rep in 1 2 3; do
  run "8MB-N4-frame" $rep '["fixture",8,4,{"policy":"frame"}]'
  run "8MB-N4-task" $rep '["fixture",8,4,{"policy":"task"}]'
  run "8MB-N4-end" $rep '["fixture",8,4,{"policy":"end"}]'
  run "8MB-N1-task" $rep '["fixture",8,1,{"policy":"task"}]'
  run "8MB-N2-task" $rep '["fixture",8,2,{"policy":"task"}]'
  run "8MB-N8-task" $rep '["fixture",8,8,{"policy":"task"}]'
  run "8MB-N4-first32" $rep '["fixture",8,4,{"policy":"task","firstKB":32}]'
  run "8MB-N4-first512" $rep '["fixture",8,4,{"policy":"task","firstKB":512}]'
done
for rep in 1 2; do
  run "32MB-N8-task" $rep '["fixture",32,8,{"policy":"task"}]'
  run "32MB-N8-end" $rep '["fixture",32,8,{"policy":"end"}]'
  run "32MB-N4-task" $rep '["fixture",32,4,{"policy":"task"}]'
  run "32MB-N8-frame" $rep '["fixture",32,8,{"policy":"frame"}]'
done
echo done > perf-results/analysis/open-parallel-raw/prog.done
