import { createElement, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { AllSelection, EditorState, Selection, type Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { ProseMirror, ProseMirrorDoc, reactKeys, useEditorEffect } from "@handlewithcare/react-prosemirror";

import { defaultPlugins, getProsemirrorText } from "@/services/prosemirror";
import { markdownToProseMirror } from "@/services/markdown/remark";

import { nodeViewsFor, pluginsFor } from "../plugins";
import { nextFrame, sampleBlank, type Scenario, type Session, type Stage, type Where } from "../types";

/**
 * @handlewithcare/react-prosemirror: o documento é renderizado pelo React (ReactEditorView), não pelo
 * DOM próprio do prosemirror-view. Só roda no servidor "playground-react" (scripts/pm-perf/run.mjs),
 * onde prosemirror-view é a 1.42.3 que a biblioteca exige.
 *
 *   react             não controlado (defaultState): o state vive dentro do <ProseMirror>, como no react-pm/
 *   react-controlled  controlado (state + dispatchTransaction num useState do pai), o padrão "state no React"
 *
 * Escrito com createElement para não precisar de JSX no playground (lá o .tsx é do plugin vue-jsx).
 */
export async function openReact(file: File, scenario: Scenario, stage: Stage, scroller: HTMLElement, mount: HTMLElement): Promise<Session> {
  scroller.classList.add("padded");
  if (scenario.noSpellcheck) mount.setAttribute("spellcheck", "false");

  const controlled = scenario.strategy == "react-controlled";
  const nodeViews = nodeViewsFor(scenario.plugins);
  const root = createRoot(mount);

  let view: EditorView;
  let generation = 0;

  /** Renderiza um editor novo (key nova = remonta, que é o que o react-pm/ faz ao trocar de arquivo). */
  function render(state: EditorState): Promise<EditorView> {
    return new Promise((resolve) => {
      function Bridge() {
        useEditorEffect((created) => { if (created) resolve(created); });
        return null;
      }

      function Editor() {
        const [current, setCurrent] = useState(state);
        const props = controlled
          ? { state: current, dispatchTransaction: (tr: Transaction) => setCurrent((s) => s.apply(tr)) }
          : { defaultState: state };

        return createElement(ProseMirror, { ...props, nodeViews }, createElement(ProseMirrorDoc), createElement(Bridge));
      }

      flushSync(() => root.render(createElement(Editor, { key: ++generation })));
    });
  }

  const text = await stage("read", () => file.text());

  const doc = await stage("parse", () => markdownToProseMirror(text), (d) => ({ topLevelBlocks: d.childCount, docSize: d.content.size }));

  const state = await stage("state", async () => EditorState.create({ doc, plugins: [reactKeys(), ...pluginsFor(scenario.plugins, scenario.noHighlight)] }));

  view = await stage("mount", async () => {
    const created = await render(state);
    void scroller.scrollHeight;
    await nextFrame();
    await nextFrame();
    return created;
  }, () => ({ domNodes: document.getElementsByTagName("*").length }));

  const positionFor = (where: Where) => {
    const size = view.state.doc.content.size;
    return where == "start" ? 0 : where == "end" ? size : Math.floor(size / 2);
  };

  return {
    async placeCaret(where) {
      const selection = Selection.near(view.state.doc.resolve(positionFor(where)), where == "end" ? -1 : 1);
      view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
      view.focus();
      await nextFrame();
    },
    caretOrder: () => view.state.selection.head,
    contentSize: () => view.state.doc.content.size,
    blankFraction: () => sampleBlank(scroller, (element) => !!element?.closest?.(".pm-placeholder")),
    async save() {
      return new Blob([await getProsemirrorText(view)]);
    },
    copyAllLength() {
      const slice = new AllSelection(view.state.doc).content();
      return view.serializeForClipboard(slice).text.length;
    },
    // Mesmo caminho do react-pm/ ao trocar de arquivo: parse + state com a lista real de plugins + remontagem.
    reopen: scenario.plugins != "all" || scenario.noHighlight ? undefined : async (content) => {
      const next = EditorState.create({ doc: await markdownToProseMirror(content), plugins: [reactKeys(), ...defaultPlugins] });
      view = await render(next);
    },
  };
}
