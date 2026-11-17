import { EditorState } from "prosemirror-state";
import { reactKeys } from "@handlewithcare/react-prosemirror";

import { defaultPlugins } from "@/services/prosemirror";
import { markdownToProseMirror } from "@/services/markdown/remark";

import { metrics } from "../metrics";

/**
 * O mesmo state do app Vue (buildProsemirrorState): mesmo parser markdown → ProseMirror, mesmo schema,
 * mesma lista de plugins. A única diferença é o reactKeys(), obrigatório no react-prosemirror
 * (dá uma key React estável para cada nó, para o reconciliador não recriar o DOM a cada transação).
 */
export async function buildReactProsemirrorState(markdown: string) {
  const parseStarted = performance.now();
  const doc = await markdownToProseMirror(markdown);
  const stateStarted = performance.now();
  const state = EditorState.create({ doc, plugins: [reactKeys(), ...defaultPlugins] });

  metrics.set({
    parseMs: stateStarted - parseStarted,
    stateMs: performance.now() - stateStarted,
    bytes: new Blob([markdown]).size,
    topLevelBlocks: doc.childCount,
  });

  return state;
}
