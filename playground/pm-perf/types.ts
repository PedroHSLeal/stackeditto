import type { CorpusKind } from "./corpus";

export type PluginSet = "none" | "input-rules" | "keymaps" | "cursors" | "highlight" | "html-nodeview" | "all" | "all-no-highlight" | "all-incremental-highlight" | "all-viewport-highlight";

export type Scenario = {
  id: string;
  strategy: "full" | "content-visibility" | "pm-window" | "chunked" | "monaco" | "react" | "react-controlled";
  /** "1.42.3": runs on the playground-react server (prosemirror-view 1.42.3, unpatched), which react-prosemirror requires. */
  view?: "app" | "1.42.3";
  plugins: PluginSet;
  kind: CorpusKind;
  sizeMB: number;
  parseBreakdown?: boolean;
  /** --no-highlight: drop the code-block highlight plugins from every plugin set. */
  noHighlight?: boolean;
  /** spellcheck="false" on the editor (Chrome spellchecking large documents is a known cost). */
  noSpellcheck?: boolean;
  /** Parse markdown in a Web Worker and ship doc.toJSON() back, instead of on the main thread. */
  parseInWorker?: boolean;
  repeat?: number;
  timeoutSec?: number;
};

export type Where = "start" | "middle" | "end";

/** What the runner may do to an opened document, whichever strategy opened it. */
export type Session = {
  placeCaret(where: Where): Promise<void>;
  /** Number that must grow as the caret moves down the document. */
  caretOrder(): number;
  /** Characters in the document, to prove keystrokes really landed. */
  contentSize(): number;
  /** Share of sampled viewport points that show a placeholder instead of content. */
  blankFraction(): number;
  save(): Promise<Blob>;
  /** Text a select-all + copy would put on the clipboard; null if the strategy cannot. */
  copyAllLength?(): number | null;
  /** Re-open the same text through the path the app uses when switching files. */
  reopen?(text: string): Promise<void>;
};

export type Stage = <T>(name: string, fn: () => Promise<T>, extra?: (result: T) => Record<string, unknown>) => Promise<T>;

export const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => {
  const channel = new MessageChannel();
  channel.port1.onmessage = () => resolve();
  channel.port2.postMessage(0);
}));

export function sampleBlank(scroller: HTMLElement, isBlank: (element: Element | null) => boolean): number {
  const rect = scroller.getBoundingClientRect();
  const SAMPLES = 9;
  let blank = 0;

  for (let i = 0; i < SAMPLES; i++) {
    const y = rect.top + rect.height * ((i + 0.5) / SAMPLES);
    if (isBlank(document.elementFromPoint(rect.left + rect.width / 2, y))) blank++;
  }

  return blank / SAMPLES;
}
