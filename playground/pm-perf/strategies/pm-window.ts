import { Virtualizer, elementScroll, observeElementOffset, observeElementRect } from "@tanstack/virtual-core";
import type { Node } from "prosemirror-model";
import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView, type NodeView, type NodeViewConstructor } from "prosemirror-view";

/**
 * SPIKE: windowing inside a single EditorView.
 *
 * ProseMirror insists that the DOM mirrors the document, but a node view with no
 * contentDOM is opaque to it. So every top-level block is a placeholder div of the
 * right height unless a node decoration marks it as visible. Moving the window just
 * changes the decoration set; ProseMirror then redraws only the blocks that changed.
 *
 *   - The document, selection, undo and transactions stay single and whole, so copy
 *     and serialization (which read the state, not the DOM) keep working.
 *   - Placeholders stay in normal flow, so the browser's scroll anchoring applies.
 *   - TanStack Virtual is used purely for the maths (block heights -> visible range).
 *     Its usual job of positioning rows cannot apply: ProseMirror owns this DOM.
 *
 * The caret's blocks are always kept rendered: a native selection cannot live inside
 * a placeholder.
 */

type WindowState = { from: number; to: number; decorations: DecorationSet };

const key = new PluginKey<WindowState>("pm-window");
const OVERSCAN = 20;
const INITIAL_BLOCKS = 40;

const CHARS_PER_LINE = 150;
const LINE_HEIGHT = 18;
const BLOCK_GAP = 16;

const measured = new WeakMap<Node, number>();
const offsetsByDoc = new WeakMap<Node, Int32Array>();

function estimateHeight(node: Node): number {
  const known = measured.get(node);
  if (known !== undefined) return known;

  if (node.type.name == "code_block") {
    let lines = 1;
    const text = node.textContent;
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) == 10) lines++;
    return lines * LINE_HEIGHT + BLOCK_GAP;
  }

  // Lists and tables: one line per child at least.
  const lines = Math.max(node.isTextblock ? 1 : node.childCount, Math.ceil(node.content.size / CHARS_PER_LINE));
  return lines * LINE_HEIGHT + BLOCK_GAP;
}

/** Start position of every top-level block; ProseMirror's own lookup is linear in child count. */
function offsetsOf(doc: Node): Int32Array {
  let offsets = offsetsByDoc.get(doc);

  if (!offsets) {
    offsets = new Int32Array(doc.childCount + 1);
    doc.forEach((child, offset, index) => { offsets![index] = offset; offsets![index + 1] = offset + child.nodeSize; });
    offsetsByDoc.set(doc, offsets);
  }

  return offsets;
}

function indexAt(doc: Node, pos: number): number {
  const offsets = offsetsOf(doc);
  let low = 0, high = doc.childCount - 1;

  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (offsets[middle] <= pos) low = middle;
    else high = middle - 1;
  }

  return low;
}

function isTopLevelPos(doc: Node, pos: number): boolean {
  const offsets = offsetsOf(doc);
  return offsets[indexAt(doc, pos)] == pos;
}

function buildDecorations(state: EditorState, from: number, to: number): DecorationSet {
  const { doc, selection } = state;
  const offsets = offsetsOf(doc);
  const last = doc.childCount - 1;
  const indices = new Set<number>();

  for (let i = Math.max(0, from); i <= Math.min(last, to); i++) indices.add(i);

  // Pin the caret's blocks and their neighbours, so arrow keys always have somewhere to go.
  for (const pos of [selection.anchor, selection.head]) {
    const index = indexAt(doc, pos);
    for (let i = Math.max(0, index - 1); i <= Math.min(last, index + 1); i++) indices.add(i);
  }

  const decorations = [...indices].sort((a, b) => a - b).map((i) =>
    Decoration.node(offsets[i], offsets[i + 1], {}, { pmWindowVisible: true }));

  return DecorationSet.create(doc, decorations);
}

const isVisible = (decorations: readonly Decoration[]) => decorations.some((d) => (d as any).spec?.pmWindowVisible);

const WINDOWED_TYPES = ["paragraph", "heading", "blockquote", "code_block", "bullet_list", "ordered_list", "table", "html_block"];

export function createWindowing(scroller: HTMLElement) {
  let virtualizer: Virtualizer<HTMLElement, Element> | undefined;

  const plugin = new Plugin<WindowState>({
    key,
    state: {
      init: (_, state) => ({ from: 0, to: INITIAL_BLOCKS, decorations: buildDecorations(state, 0, INITIAL_BLOCKS) }),
      apply(tr, previous, _old, state) {
        const range = tr.getMeta(key) as { from: number; to: number } | undefined;

        if (!range && !tr.docChanged && !tr.selectionSet) return previous;

        const from = range?.from ?? previous.from;
        const to = range?.to ?? previous.to;

        return { from, to, decorations: buildDecorations(state, from, to) };
      },
    },
    props: {
      decorations: (state) => key.getState(state)!.decorations,
    },
  });

  function wrapNodeViews(base: { [name: string]: NodeViewConstructor }) {
    const wrapped: { [name: string]: NodeViewConstructor } = { ...base };

    for (const name of WINDOWED_TYPES) {
      const original = base[name];

      wrapped[name] = (node, view, getPos, decorations, innerDecorations): NodeView => {
        const pos = getPos();
        const inner = (original?.(node, view, getPos, decorations, innerDecorations) ?? {}) as Partial<NodeView>;

        // Nested nodes are only ever built inside a visible block.
        if (pos === undefined || !isTopLevelPos(view.state.doc, pos)) return inner as NodeView;

        if (!isVisible(decorations)) {
          const dom = document.createElement("div");
          dom.className = "pm-placeholder";
          dom.style.height = `${estimateHeight(node)}px`;

          return {
            dom,
            update(next, nextDecorations) {
              if (isVisible(nextDecorations)) return false;
              dom.style.height = `${estimateHeight(next)}px`;
              return true;
            },
            ignoreMutation: () => true,
          };
        }

        let current = node;

        return {
          ...inner,
          update(next, nextDecorations, nextInner) {
            if (!isVisible(nextDecorations) || !next.sameMarkup(current)) return false;
            // Node views without contentDOM (html_block) cannot patch their children.
            if (original && !inner.contentDOM && next !== current) return false;
            current = next;
            return inner.update ? inner.update(next, nextDecorations, nextInner) : true;
          },
        } as NodeView;
      };
    }

    return wrapped;
  }

  function attach(view: EditorView) {
    let frame = 0;

    const sync = () => {
      frame = 0;
      if (!virtualizer) return;

      const items = virtualizer.getVirtualItems();
      if (!items.length) return;

      const from = items[0].index;
      const to = items[items.length - 1].index;
      const current = key.getState(view.state)!;

      if (current.from != from || current.to != to) {
        view.dispatch(view.state.tr.setMeta(key, { from, to }).setMeta("addToHistory", false));
      }

      measureRendered(view);
    };

    virtualizer = new Virtualizer<HTMLElement, Element>({
      count: view.state.doc.childCount,
      getScrollElement: () => scroller,
      estimateSize: (index) => estimateHeight(view.state.doc.child(Math.min(index, view.state.doc.childCount - 1))),
      scrollToFn: elementScroll,
      observeElementRect,
      observeElementOffset,
      overscan: OVERSCAN,
      onChange: () => { if (!frame) frame = requestAnimationFrame(sync); },
    });

    // ProseMirror's DOM is in normal flow, so the browser's scroll anchoring handles this.
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false;

    virtualizer._didMount();
    virtualizer._willUpdate();

    frame = requestAnimationFrame(sync);
  }

  /** Replace estimates with real heights (including collapsed margins) for what is on screen. */
  function measureRendered(view: EditorView) {
    const { from, to } = key.getState(view.state)!;
    const doc = view.state.doc;
    const children = view.dom.children;

    for (let i = from; i <= to && i + 1 < children.length; i++) {
      const element = children[i] as HTMLElement;
      if (element.classList.contains("pm-placeholder")) continue;

      const height = (children[i + 1] as HTMLElement).offsetTop - element.offsetTop;

      if (height > 0 && measured.get(doc.child(i)) != height) {
        measured.set(doc.child(i), height);
        virtualizer!.resizeItem(i, height);
      }
    }
  }

  return { plugin, wrapNodeViews, attach };
}
