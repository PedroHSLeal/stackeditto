import { memo, useCallback, useRef } from "react";
import type { EditorState, Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { ProseMirror, ProseMirrorDoc, useEditorEffect, useEditorEventCallback } from "@handlewithcare/react-prosemirror";

import { defaultNodeViews, setDefaultView } from "@/services/prosemirror";
import { defaultTopMenuActions } from "@/models/top-menu";

import { markMounted } from "../metrics";

type Props = {
  /** EditorState inicial; trocar de arquivo remonta o componente (key = caminho do arquivo). */
  state: EditorState;
  onReady(view: EditorView): void;
  onDocChanged(): void;
};

/**
 * Editor markdown sobre @handlewithcare/react-prosemirror, no modo não controlado (defaultState):
 * o state vive dentro do <ProseMirror>, e só ele re-renderiza a cada transação.
 *
 * O node view de bloco HTML das extensões é o mesmo do app Vue (HtmlBlockView, um NodeViewConstructor
 * clássico): o react-prosemirror aceita os construtores antigos pela prop `nodeViews`, ao lado de
 * `nodeViewComponents` para node views em React.
 */
export const MarkdownEditor = memo(function MarkdownEditor({ state, onReady, onDocChanged }: Props) {
  // A prop precisa ser estável: o useEditor recria a lista de props do EditorView quando ela muda.
  const latest = useRef(onDocChanged);
  latest.current = onDocChanged;
  const dispatchTransaction = useCallback((tr: Transaction) => { if (tr.docChanged) latest.current(); }, []);

  return (
    <ProseMirror defaultState={state} nodeViews={defaultNodeViews} dispatchTransaction={dispatchTransaction}>
      <TopMenu />
      <div style={{ flex: 1, overflow: "auto" }} id="pm-scroller">
        <div style={{ display: "flex", flexDirection: "column", padding: "6px 12px", width: "100%" }}>
          <p style={{ margin: "0 0 12px 0", textAlign: "center", color: "lightgray", cursor: "default" }}>--*--</p>
          <ProseMirrorDoc />
          <p style={{ margin: "12px 0 0 0", textAlign: "center", color: "lightgray", cursor: "default" }}>--*--</p>
        </div>
      </div>
      <ViewBridge onReady={onReady} />
    </ProseMirror>
  );
});

/** Entrega a view montada para o App (salvar/serializar) e para o executeCommand dos botões do menu. */
function ViewBridge({ onReady }: { onReady(view: EditorView): void }) {
  const reported = useRef<EditorView | null>(null);

  useEditorEffect((view) => {
    if (!view || reported.current === view) return;
    reported.current = view;
    setDefaultView(view);
    onReady(view);
    void markMounted();
  });

  return null;
}

// "material-symbols:format-h1" → "H1": o menu do app usa ícones do Iconify (Vue); aqui basta texto.
const LABELS: Record<string, string> = { "format-list-numbered": "1.", "format-list-bulleted": "•" };
const labelOf = (icon = "") => {
  const name = icon.split(":").pop() ?? "";
  return LABELS[name] ?? name.replace("format-", "").toUpperCase();
};

/** As mesmas ações do TopMenu.vue (src/models/top-menu.ts), chamadas por useEditorEventCallback. */
function TopMenu() {
  const run = useEditorEventCallback((view, fn: () => unknown) => {
    if (!view) return;
    setDefaultView(view);
    fn();
    view.focus();
  });

  return (
    <div style={{ display: "flex", gap: 4, padding: "4px 12px", borderBottom: "1px solid #eee", flexWrap: "wrap" }}>
      {defaultTopMenuActions.flat().map((action, index) => (
        <button key={index} className="secondary" title={action.icon} onMouseDown={(e) => e.preventDefault()} onClick={() => run(action.fn)}>
          {action.text ?? labelOf(action.icon)}
        </button>
      ))}
    </div>
  );
}
