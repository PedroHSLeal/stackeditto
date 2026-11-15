import { Virtualizer, elementScroll, observeElementOffset, observeElementRect } from "@tanstack/virtual-core";
import { EditorState, Selection, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { markdownToProseMirror, proseMirrorToMarkdown } from "@/services/markdown/remark";

import { nodeViewsFor, pluginsFor } from "../plugins";
import { nextFrame, sampleBlank, type Scenario, type Session, type Stage } from "../types";

/**
 * SPIKE: one small EditorView per visible chunk of the file, positioned by TanStack
 * Virtual. This is the shape ProseMirror's maintainer recommends for very large
 * documents (see docs/prosemirror-performance.md).
 *
 * The file is never loaded whole. A streaming pass records byte offsets of safe
 * block boundaries; a chunk is read with file.slice() only when it scrolls near the
 * viewport, and released when it leaves. Saving stitches untouched byte ranges and
 * edited text into a Blob, so unedited chunks come back byte-identical.
 *
 * Known limits of this spike: no selection across chunks, per-chunk undo, reference
 * links whose definition lives in another chunk do not resolve, and a blank line
 * inside a top-level HTML block can be chosen as a boundary.
 */

const TARGET_CHUNK_BYTES = 32 * 1024;
const LF = 10, CR = 13, SPACE = 32, TAB = 9, BACKTICK = 96, TILDE = 126;

export async function indexChunks(file: File): Promise<number[]> {
  const boundaries = [0];
  const reader = file.stream().getReader();

  let offset = 0, lineStart = true, lineLength = 0, previousBlank = false, inFence = false;
  let fenceChar = 0, fenceRun = 0, leadingSpaces = 0, lineHasContent = false;

  for (; ;) {
    const { done, value } = await reader.read();
    if (done) break;

    for (let i = 0; i < value.length; i++) {
      const byte = value[i];

      if (lineStart && !inFence && previousBlank && byte != LF && byte != CR && byte != SPACE && byte != TAB) {
        // A non-indented line after a blank line, outside a fence: a block starts here.
        if (offset + i - boundaries[boundaries.length - 1] >= TARGET_CHUNK_BYTES) boundaries.push(offset + i);
      }

      if (byte == LF) {
        if (fenceRun >= 3 && leadingSpaces <= 3) {
          if (!inFence) { inFence = true; }
          else { inFence = false; }
        }
        previousBlank = !lineHasContent;
        lineStart = true; lineLength = 0; fenceRun = 0; fenceChar = 0; leadingSpaces = 0; lineHasContent = false;
        continue;
      }

      if (byte != CR && byte != SPACE && byte != TAB) lineHasContent = true;

      if (lineLength == leadingSpaces && byte == SPACE) leadingSpaces++;
      else if ((byte == BACKTICK || byte == TILDE) && lineLength == leadingSpaces + fenceRun && (fenceChar == 0 || fenceChar == byte)) { fenceChar = byte; fenceRun++; }

      lineLength++;
      lineStart = false;
    }

    offset += value.length;
  }

  return boundaries;
}

type Row = { index: number; element: HTMLElement; view?: EditorView; ready: Promise<void>; removed: boolean };

export async function openChunked(file: File, scenario: Scenario, stage: Stage, scroller: HTMLElement, mount: HTMLElement): Promise<Session> {
  const boundaries = await stage("index", () => indexChunks(file), (b) => ({ chunks: b.length }));
  const end = (index: number) => boundaries[index + 1] ?? file.size;
  const count = boundaries.length;

  const edits = new Map<number, string>();
  const dirty = new Set<number>();
  const rows = new Map<number, Row>();

  const plugins = pluginsFor(scenario.plugins, scenario.noHighlight);
  const nodeViews = nodeViewsFor(scenario.plugins);

  let pxPerByte = 0.45;
  let focused: Row | undefined;

  const readChunk = async (index: number) => edits.get(index) ?? await file.slice(boundaries[index], end(index)).text();

  const moveAcross = (from: number, direction: 1 | -1) => {
    const target = rows.get(from + direction)?.view;
    if (!target) return false;

    const doc = target.state.doc;
    target.dispatch(target.state.tr.setSelection(direction > 0 ? Selection.atStart(doc) : Selection.atEnd(doc)).scrollIntoView());
    target.focus();
    focused = rows.get(from + direction);
    return true;
  };

  async function mountRow(row: Row) {
    const doc = await markdownToProseMirror(await readChunk(row.index));
    if (row.removed) return;

    const state = EditorState.create({ doc, plugins });

    row.view = new EditorView(row.element, {
      state,
      nodeViews,
      dispatchTransaction(tr) {
        const view = row.view!;
        view.updateState(view.state.apply(tr));
        if (tr.docChanged) dirty.add(row.index);
      },
      handleDOMEvents: { focus: () => { focused = row; return false; } },
      handleKeyDown(view, event) {
        if (event.key == "ArrowDown" && view.endOfTextblock("down") && view.state.selection.$head.after(1) >= view.state.doc.content.size) return moveAcross(row.index, 1);
        if (event.key == "ArrowUp" && view.endOfTextblock("up") && view.state.selection.$head.before(1) <= 0) return moveAcross(row.index, -1);
        return false;
      },
    });

    // Only now: measured empty, every row is 0px tall, they all "fit" in the viewport,
    // and the virtualizer mounts (and parses) the entire file.
    virtualizer.measureElement(row.element);

    const height = row.element.getBoundingClientRect().height;
    const bytes = end(row.index) - boundaries[row.index];
    if (height > 0 && bytes > 0) pxPerByte = pxPerByte * 0.8 + (height / bytes) * 0.2;
  }

  async function unmountRow(row: Row) {
    row.removed = true;
    await row.ready;

    if (row.view) {
      if (dirty.has(row.index)) {
        edits.set(row.index, await proseMirrorToMarkdown(row.view.state.doc));
        dirty.delete(row.index);
      }
      row.view.destroy();
    }

    row.element.remove();
  }

  mount.style.position = "relative";

  const syncRows = () => {
    const items = virtualizer.getVirtualItems();
    const wanted = new Set(items.map((item) => item.index));

    mount.style.height = `${virtualizer.getTotalSize()}px`;

    for (const [index, row] of rows) {
      if (!wanted.has(index) && row !== focused) {
        rows.delete(index);
        void unmountRow(row);
      }
    }

    for (const item of items) {
      let row = rows.get(item.index);

      if (!row) {
        const element = document.createElement("div");
        element.dataset.index = String(item.index);
        element.style.cssText = "position:absolute;left:0;right:0;top:0;padding:0 12px;";
        mount.appendChild(element);

        row = { index: item.index, element, removed: false, ready: Promise.resolve() };
        row.ready = mountRow(row);
        rows.set(item.index, row);
      }

      row.element.style.transform = `translateY(${item.start}px)`;
    }
  };

  let frame = 0;

  const virtualizer = new Virtualizer<HTMLElement, HTMLElement>({
    count,
    getScrollElement: () => scroller,
    estimateSize: (index) => (end(index) - boundaries[index]) * pxPerByte,
    scrollToFn: elementScroll,
    observeElementRect,
    observeElementOffset,
    overscan: 1,
    onChange: () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; syncRows(); }); },
  });

  /** Until two frames in a row have nothing left to mount. */
  const settle = async () => {
    let quiet = 0;

    for (let i = 0; i < 200 && quiet < 2; i++) {
      await nextFrame();
      const pending = [...rows.values()].filter((r) => !r.view && !r.removed);
      await Promise.all(pending.map((r) => r.ready));
      quiet = pending.length ? 0 : quiet + 1;
    }
  };

  await stage("mount", async () => {
    virtualizer._didMount();
    virtualizer._willUpdate();
    syncRows();
    await settle();
  }, () => ({ domNodes: document.getElementsByTagName("*").length }));

  return {
    async placeCaret(where) {
      const index = where == "start" ? 0 : where == "end" ? count - 1 : Math.floor(count / 2);

      // Estimated heights move as chunks get measured, so the jump may need more than one try.
      for (let attempt = 0; attempt < 20 && !rows.has(index); attempt++) {
        virtualizer.scrollToIndex(index, { align: "start" });
        await nextFrame();
        syncRows();
        await settle();
      }

      const row = rows.get(index);
      if (!row) throw new Error(`chunk ${index} never mounted`);
      await row.ready;

      const view = row.view!;
      const doc = view.state.doc;
      const pos = where == "end" ? doc.content.size : where == "start" ? 0 : Math.floor(doc.content.size / 2);
      const selection = Selection.near(doc.resolve(pos), where == "end" ? -1 : 1);

      view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
      view.focus();
      focused = row;
      await nextFrame();
    },
    caretOrder() {
      if (!focused?.view) return -1;
      const selection = focused.view.state.selection as TextSelection;
      return focused.index * 1e8 + selection.head;
    },
    contentSize: () => focused?.view?.state.doc.content.size ?? 0,
    blankFraction: () => sampleBlank(scroller, (element) => {
      const row = element?.closest?.("[data-index]") as HTMLElement | null;
      return !!row && !rows.get(Number(row.dataset.index))?.view;
    }),
    async save() {
      for (const row of rows.values()) {
        if (row.view && dirty.has(row.index)) {
          edits.set(row.index, await proseMirrorToMarkdown(row.view.state.doc));
          dirty.delete(row.index);
        }
      }

      const parts: BlobPart[] = [];

      for (let i = 0; i < count; i++) {
        parts.push(edits.get(i) ?? file.slice(boundaries[i], end(i)));
      }

      return new Blob(parts);
    },
    copyAllLength: () => null,
  };
}
