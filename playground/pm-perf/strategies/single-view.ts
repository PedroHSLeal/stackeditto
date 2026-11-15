import { Selection, AllSelection, EditorState, type Plugin } from "prosemirror-state";
import { Node as PMNode } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import { EditorView as View } from "prosemirror-view";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { buildProsemirrorView, getProsemirrorText, mySchema, updateProsemirrorView } from "@/services/prosemirror";
import { markdownToProseMirror } from "@/services/markdown/remark";

import { nodeViewsFor, pluginsFor } from "../plugins";
import { nextFrame, sampleBlank, type Scenario, type Session, type Stage, type Where } from "../types";
import { createWindowing } from "./pm-window";

const SEPARATE_PARSE_LIMIT = 16 * 1024 * 1024;

/** Longest stretch the main thread could not answer a message: what a user would feel as a freeze. */
function mainThreadProbe() {
  let last = performance.now();
  let max = 0;
  let running = true;
  const channel = new MessageChannel();
  channel.port1.onmessage = () => {
    const now = performance.now();
    max = Math.max(max, now - last);
    last = now;
    if (running) channel.port2.postMessage(0);
  };
  channel.port2.postMessage(0);
  return { stop: () => { running = false; max = Math.max(max, performance.now() - last); return Math.round(max); } };
}

/** Strategies that keep one EditorView and the whole document in memory. */
export async function openSingleView(file: File, scenario: Scenario, stage: Stage, scroller: HTMLElement, mount: HTMLElement): Promise<Session> {
  scroller.classList.add("padded");
  if (scenario.strategy == "content-visibility") scroller.classList.add("cv");

  const text = await stage("read", () => file.text());

  if (scenario.parseBreakdown && file.size <= SEPARATE_PARSE_LIMIT) {
    await stage("parse:remark-core", async () => { unified().use(remarkParse).parse(text); });
    await stage("parse:+gfm", async () => { unified().use(remarkParse).use(remarkGfm).parse(text); });
    await stage("parse:+gfm+frontmatter", async () => { unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter).parse(text); });
  }

  // Worker boot (module graph + Shiki) is paid before "read" in a real app too, so it gets its own stage.
  const worker = scenario.parseInWorker
    ? await stage("worker-boot", () => new Promise<Worker>((resolve, reject) => {
      const w = new Worker(new URL("../parse-worker.ts", import.meta.url), { type: "module" });
      w.onmessage = () => resolve(w);
      w.onerror = (e) => reject(new Error(e.message));
    }))
    : null;

  const probe = mainThreadProbe();
  let workerTimes: Record<string, number> = {};
  const doc = await stage("parse", async () => {
    if (!worker) return markdownToProseMirror(text);

    const reply = await new Promise<any>((resolve) => { worker.onmessage = (e) => resolve(e.data); worker.postMessage(text); });
    if (reply.error) throw new Error(reply.error);
    const started = performance.now();
    const node = PMNode.fromJSON(mySchema, reply.json);
    workerTimes = { workerParseMs: Math.round(reply.parseMs), toJsonMs: Math.round(reply.toJsonMs), fromJsonMs: Math.round(performance.now() - started) };
    worker.terminate();
    return node;
  }, (d) => ({ topLevelBlocks: d.childCount, docSize: d.content.size, mainThreadMaxBlockMs: probe.stop(), ...workerTimes }));

  const windowing = scenario.strategy == "pm-window" ? createWindowing(scroller) : null;
  const plugins: Plugin[] = [...pluginsFor(scenario.plugins, scenario.noHighlight), ...(windowing ? [windowing.plugin] : [])];

  const state = await stage("state", async () => EditorState.create({ doc, plugins }));

  const view: EditorView = await stage("mount", async () => {
    const nodeViews = nodeViewsFor(scenario.plugins);
    // The app's own constructor, except where windowing has to wrap the node views.
    const created = windowing
      ? new View(mount, { state, nodeViews: windowing.wrapNodeViews(nodeViews) })
      : buildProsemirrorView(mount, state, nodeViews);

    windowing?.attach(created);
    if (scenario.noSpellcheck) created.setProps({ attributes: { spellcheck: "false" } });

    // Force layout, then wait for a frame: the DOM exists but has not cost anything until now.
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
    // updateProsemirrorView installs the app's real plugin list, so on any other list it
    // would silently change what the rest of the scenario is measuring.
    // reopen runs the app's real buildProsemirrorState, which always includes the highlight plugin
    reopen: windowing || scenario.plugins != "all" || scenario.noHighlight ? undefined : (content) => updateProsemirrorView(view, content),
  };
}

export { mySchema };
