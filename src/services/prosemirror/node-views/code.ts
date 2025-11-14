import { EditorView as CodemirrorEditorView, ViewUpdate, keymap as cmKeymap, drawSelection } from "@codemirror/view"
import { javascript } from "@codemirror/lang-javascript"
import { defaultKeymap } from "@codemirror/commands"
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language"

import { exitCode } from "prosemirror-commands"
import { undo, redo } from "prosemirror-history"
import type { Decoration, DecorationSource, EditorView as ProsemirrorEditorView, NodeView, NodeViewConstructor, ViewMutationRecord } from "prosemirror-view"
import { Slice, type Node } from "prosemirror-model"
import { EditorState as ProsemirrorEditorState, Selection, TextSelection, Transaction as ProsemirrorTransaction, SelectionRange } from "prosemirror-state"
import { schema } from "prosemirror-schema-basic";
import type { Line } from "~/@codemirror/state/dist"
import { AttrStep } from "~/prosemirror-transform/dist"

export class CodeBlockView implements NodeView {
  dom: InstanceType<typeof window.Node>;
  node: Node;
  view: ProsemirrorEditorView;
  getPos: () => number | undefined;

  cm: CodemirrorEditorView | undefined;

  intersectionObserver: IntersectionObserver;

  updating: boolean;

  contentDOM?: HTMLElement | null | undefined
  multiType?: boolean | undefined
  deselectNode?: (() => void) | undefined
  ignoreMutation?: ((mutation: ViewMutationRecord) => boolean) | undefined
  destroy?: (() => void) | undefined

  constructor(node: Node, view: ProsemirrorEditorView, getPos: () => number | undefined, decorations: readonly Decoration[], innerDecorations: DecorationSource) {
    // Store for later
    this.node = node
    this.view = view
    this.getPos = getPos

    // Create a CodeMirror instance
    this.cm = new CodemirrorEditorView({
      doc: this.node.attrs.content,
      extensions: [
        cmKeymap.of([
          ...this.codeMirrorKeymap(),
          ...defaultKeymap
        ]),
        drawSelection(),
        syntaxHighlighting(defaultHighlightStyle),
        javascript(),
        CodemirrorEditorView.updateListener.of(update => this.forwardUpdate(update))
      ]
    })

    // The editor's outer node is our DOM representation
    this.dom = this.cm.dom;

    // This flag is used to avoid an update loop between the outer and
    // inner editor
    this.updating = false;

    this.intersectionObserver = new IntersectionObserver((entries, observer) => {
      let el = entries.find(e => e.isIntersecting);
      // if (!el) {
      // this.cm?.destroy();
      // }
      // else {
      // }
    }, { root: null, rootMargin: "10% 0px", threshold: 1.0 });

    // this.intersectionObserver.observe(this.dom);
  }

  updateValueContent() {
    let tr = this.view.state.tr;
    tr.setNodeMarkup(this.view.posAtDOM(this.dom, 0), this.node.type, { ...this.node.attrs, content: "console.log(1)" });
  }

  setSelection(anchor: number, head: number, root: Document | ShadowRoot) {
    this.cm!.focus()
    this.updating = true
    this.cm!.dispatch({ selection: { anchor, head } })
    this.updating = false
  }

  selectNode() { this.cm!.focus() }
  stopEvent(event: Event): boolean { return true }

  forwardUpdate(update: ViewUpdate) {
    if (this.updating || !this.cm!.hasFocus) return
    let offset = this.getPos()! + 1, { main } = update.state.selection
    let selFrom = offset + main.from, selTo = offset + main.to
    let pmSel = this.view.state.selection
    if (update.docChanged || pmSel.from != selFrom || pmSel.to != selTo) {
      let tr = this.view.state.tr
      update.changes.iterChanges((fromA, toA, fromB, toB, text) => {
        if (text.length)
          tr.replaceWith(offset + fromA, offset + toA,
            schema.text(text.toString()))
        else
          tr.delete(offset + fromA, offset + toA)
        offset += (toB - fromB) - (toA - fromA)
      })
      tr.setSelection(TextSelection.create(tr.doc, selFrom, selTo))
      this.view.dispatch(tr)
      this.updateValueContent();
    }

  }

  codeMirrorKeymap() {
    let view = this.view
    return [
      { key: "ArrowUp", run: () => this.maybeEscape("line", -1) },
      { key: "ArrowLeft", run: () => this.maybeEscape("char", -1) },
      { key: "ArrowDown", run: () => this.maybeEscape("line", 1) },
      { key: "ArrowRight", run: () => this.maybeEscape("char", 1) },
      {
        key: "Ctrl-Enter", run: () => {
          if (!exitCode(view.state, view.dispatch)) return false
          view.focus()
          return true
        }
      },
      {
        key: "Ctrl-z", mac: "Cmd-z",
        run: () => undo(view.state, view.dispatch)
      },
      {
        key: "Shift-Ctrl-z", mac: "Shift-Cmd-z",
        run: () => redo(view.state, view.dispatch)
      },
      {
        key: "Ctrl-y", mac: "Cmd-y",
        run: () => redo(view.state, view.dispatch)
      }
    ]
  }

  maybeEscape(unit: string, dir: number) {
    let { state } = this.cm;
    let main: { empty?: boolean, from: number, to: number, head?: number } = state.selection.main;

    if (!main.empty) return false
    if (unit == "line") main = state.doc.lineAt(main.head!);
    if (dir < 0 ? main.from > 0 : main.to < state.doc.length) return false

    let targetPos = this.getPos()! + (dir < 0 ? 0 : this.node.nodeSize)
    let selection = Selection.near(this.view.state.doc.resolve(targetPos), dir)
    let tr = this.view.state.tr.setSelection(selection).scrollIntoView()
    this.view.dispatch(tr)
    this.view.focus()
  }

  update(node: Node, decorations: readonly Decoration[], innerDecorations: DecorationSource): boolean {
    if (node.type != this.node.type) return false
    this.node = node
    if (this.updating) return true
    let newText = node.textContent, curText = this.cm.state.doc.toString()
    if (newText != curText) {
      let start = 0, curEnd = curText.length, newEnd = newText.length
      while (start < curEnd &&
        curText.charCodeAt(start) == newText.charCodeAt(start)) {
        ++start
      }
      while (curEnd > start && newEnd > start &&
        curText.charCodeAt(curEnd - 1) == newText.charCodeAt(newEnd - 1)) {
        curEnd--
        newEnd--
      }
      this.updating = true
      this.cm!.dispatch({
        changes: {
          from: start, to: curEnd,
          insert: newText.slice(start, newEnd)
        }
      })

      this.updating = false
    }
    return true
  }
}

function arrowHandler(dir: any) {
  return (state: ProsemirrorEditorState, dispatch: ((tr: ProsemirrorTransaction) => void) | undefined, view: ProsemirrorEditorView | undefined) => {
    if (state.selection.empty && view!.endOfTextblock(dir)) {
      let side = dir == "left" || dir == "up" ? -1 : 1
      let $head = state.selection.$head
      let nextPos = Selection.near(
        state.doc.resolve(side > 0 ? $head.after() : $head.before()), side)
      if (nextPos.$head && nextPos.$head.parent.type.name == "code_block") {
        dispatch!(state.tr.setSelection(nextPos))
        return true
      }
    }
    return false
  }
}

export const codeBlockKeymaps = {
  ArrowLeft: arrowHandler("left"),
  ArrowRight: arrowHandler("right"),
  ArrowUp: arrowHandler("up"),
  ArrowDown: arrowHandler("down")
}