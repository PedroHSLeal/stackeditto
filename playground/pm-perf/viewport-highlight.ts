import type { Node } from "prosemirror-model";
import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import { DecorationSet, type Decoration, type EditorView } from "prosemirror-view";

import { decorate } from "./incremental-highlight";

/**
 * SPIKE: highlight only the code blocks near the viewport.
 *
 * Research (ProseMirror forum, CodeMirror's viewport decorations) points the same
 * way: keep the DecorationSet in plugin state and only map it per transaction, and
 * never tokenize what nobody is looking at. Opening a document costs nothing here;
 * a scroll tokenizes the blocks that came into view, once (a block keeps its node
 * identity until it is edited, so a WeakSet remembers what is done). Typing inside a
 * code block re-tokenizes that block only. Blocks above MAX_BLOCK_CHARS are left
 * plain: a single giant block would freeze a frame for seconds (and overflowed
 * prosemirror-highlight's stack).
 */

const MAX_BLOCK_CHARS = 20_000;
/** Top-level blocks decorated beyond each edge of the viewport, so a short scroll is already coloured. */
const BUFFER_BLOCKS = 30;

type State = { set: DecorationSet; done: WeakSet<Node> };
type Range = { from: number; to: number };

const key = new PluginKey<State>("viewport-highlight");

function decorateBlocks(doc: Node, range: Range, done: WeakSet<Node>, out: Decoration[]) {
  doc.nodesBetween(range.from, range.to, (node, pos) => {
    if (node.type.name != "code_block") return !node.isTextblock;
    if (done.has(node)) return false;

    done.add(node);
    if (node.textContent.length <= MAX_BLOCK_CHARS) out.push(...decorate(node, pos));
    return false;
  });
}

function hasPending(state: EditorState, range: Range) {
  const done = key.getState(state)!.done;
  let pending = false;

  state.doc.nodesBetween(range.from, range.to, (node) => {
    if (pending) return false;
    if (node.type.name != "code_block") return !node.isTextblock;
    pending = !done.has(node);
    return false;
  });

  return pending;
}

/** Document range on screen, widened by BUFFER_BLOCKS top-level blocks each way. */
function visibleRange(view: EditorView): Range | null {
  const rect = view.dom.getBoundingClientRect();
  const top = Math.max(rect.top, 0) + 1;
  const bottom = Math.min(rect.bottom, window.innerHeight) - 1;
  if (bottom <= top) return null;

  const left = rect.left + Math.min(40, rect.width / 2);
  const doc = view.state.doc;
  const at = (y: number, fallback: number) => view.posAtCoords({ left, top: y })?.pos ?? fallback;

  let first = doc.resolve(Math.min(at(top, 0), doc.content.size)).index(0);
  let last = doc.resolve(Math.min(at(bottom, doc.content.size), doc.content.size)).index(0);

  first = Math.max(0, first - BUFFER_BLOCKS);
  last = Math.min(doc.childCount - 1, last + BUFFER_BLOCKS);

  let from = 0;
  for (let i = 0; i < first; i++) from += doc.child(i).nodeSize;
  let to = from;
  for (let i = first; i <= last; i++) to += doc.child(i).nodeSize;

  return { from, to };
}

export function viewportHighlightPlugin() {
  return new Plugin<State>({
    key,
    state: {
      init: (_, { doc }) => ({ set: DecorationSet.create(doc, []), done: new WeakSet() }),
      apply(tr, previous) {
        const range: Range | undefined = tr.getMeta(key);
        if (!tr.docChanged && !range) return previous;

        let set = tr.docChanged ? previous.set.map(tr.mapping, tr.doc) : previous.set;
        const { done } = previous;
        const added: Decoration[] = [];

        if (tr.docChanged) {
          // An edited block is a new node object, so it is not in `done`: drop its stale
          // decorations and let decorateBlocks redo it (it is under the caret, so on screen).
          tr.mapping.maps.forEach((map, index) => {
            map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
              const after = tr.mapping.slice(index + 1);
              const from = Math.max(0, after.map(newStart, -1));
              const to = Math.min(tr.doc.content.size, after.map(newEnd, 1));

              tr.doc.nodesBetween(from, to, (node, pos) => {
                if (node.type.name != "code_block") return !node.isTextblock;
                set = set.remove(set.find(pos, pos + node.nodeSize));
                decorateBlocks(tr.doc, { from: pos, to: pos + node.nodeSize }, done, added);
                return false;
              });
            });
          });
        }

        if (range) decorateBlocks(tr.doc, range, done, added);
        if (added.length) set = set.add(tr.doc, added);

        return set == previous.set ? previous : { set, done };
      },
    },
    props: {
      decorations: (state) => key.getState(state)!.set,
    },
    view(view) {
      let frame = 0;

      const run = () => {
        frame = 0;
        const range = visibleRange(view);
        if (range && hasPending(view.state, range)) {
          view.dispatch(view.state.tr.setMeta(key, range).setMeta("addToHistory", false));
        }
      };
      const schedule = () => { if (!frame) frame = requestAnimationFrame(run); };

      // Capture: hears the scroll of whichever ancestor actually scrolls.
      window.addEventListener("scroll", schedule, { capture: true, passive: true });
      window.addEventListener("resize", schedule, { passive: true });
      schedule();

      return {
        update(updated, previousState) {
          if (updated.state.doc != previousState.doc) schedule();
        },
        destroy() {
          cancelAnimationFrame(frame);
          window.removeEventListener("scroll", schedule, { capture: true });
          window.removeEventListener("resize", schedule);
        },
      };
    },
  });
}
