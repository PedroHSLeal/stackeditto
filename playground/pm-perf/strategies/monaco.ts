import { nextFrame, type Session, type Stage } from "../types";

/** Reference point, not a candidate for rich editing: what a viewport-based editor costs on the same file. */
export async function openMonaco(file: File, stage: Stage, scroller: HTMLElement, mount: HTMLElement): Promise<Session> {
  scroller.style.overflow = "hidden";
  mount.style.height = "100%";

  const monaco = await stage("boot:monaco", async () => {
    await import("@/monaco/workers");
    return await import("monaco-editor");
  });

  const text = await stage("read", () => file.text());

  const editor = await stage("mount", async () => {
    const created = monaco.editor.create(mount, { value: text, language: "markdown", automaticLayout: true, largeFileOptimizations: true });
    await nextFrame();
    await nextFrame();
    return created;
  }, () => ({ domNodes: document.getElementsByTagName("*").length }));

  const model = editor.getModel()!;

  return {
    async placeCaret(where) {
      const line = where == "start" ? 1 : where == "end" ? model.getLineCount() : Math.floor(model.getLineCount() / 2);
      editor.setPosition({ lineNumber: line, column: where == "end" ? model.getLineMaxColumn(line) : 1 });
      editor.revealLineInCenter(line);
      editor.focus();
      await nextFrame();
    },
    caretOrder: () => model.getOffsetAt(editor.getPosition()!),
    contentSize: () => model.getValueLength(),
    blankFraction: () => 0,
    save: async () => new Blob([model.getValue()]),
    copyAllLength: () => model.getValueLength(),
  };
}
