import { buildCorpus } from "./corpus";
import { nextFrame, type Scenario, type Session, type Stage, type Where } from "./types";

/**
 * Page half of the routine; scripts/pm-perf/run.mjs is the other half. Each stage
 * reports to the runner through exposed bindings, as it finishes, so a tab that
 * crashes or times out still leaves everything it reached.
 */
declare global {
  interface Window {
    __stageStart(name: string): Promise<void>;
    __stageEnd(name: string, ms: number, extra: Record<string, unknown>): Promise<void>;
    __perf: typeof api;
  }
}

const scroller = document.querySelector<HTMLElement>("#scroller")!;
const mount = document.querySelector<HTMLElement>("#mount")!;

const stage: Stage = async (name, fn, extra) => {
  await window.__stageStart(name);
  const started = performance.now();

  try {
    const result = await fn();
    await window.__stageEnd(name, performance.now() - started, extra ? extra(result) : {});
    return result;
  } catch (error: any) {
    await window.__stageEnd(name, performance.now() - started, { error: String(error?.message ?? error).slice(0, 300) });
    throw error;
  }
};

let session: Session;
let file: File;
let latency: Promise<number> | undefined;

const api = {
  async open(scenario: Scenario) {
    file = buildCorpus(scenario.kind, scenario.sizeMB);
    await stage("corpus", async () => { }, () => ({ bytes: file.size }));

    if (scenario.strategy != "monaco") {
      // Includes Shiki's top-level await: the cost of merely importing the editor.
      await stage("boot", async () => {
        await import("@/services/prosemirror");
        await import("@/components/editors/prosemirror/Editor.vue"); // for its global .ProseMirror styles
      });
    }

    if (scenario.strategy == "monaco") {
      const { openMonaco } = await import("./strategies/monaco");
      session = await openMonaco(file, stage, scroller, mount);
    } else if (scenario.strategy == "react" || scenario.strategy == "react-controlled") {
      const { openReact } = await import("./strategies/react");
      session = await openReact(file, scenario, stage, scroller, mount);
    } else if (scenario.strategy == "chunked") {
      const { openChunked } = await import("./strategies/chunked");
      session = await openChunked(file, scenario, stage, scroller, mount);
    } else {
      const { openSingleView } = await import("./strategies/single-view");
      session = await openSingleView(file, scenario, stage, scroller, mount);
    }
  },

  async save(compareWithOriginal: boolean) {
    const blob = await stage("save", () => session.save(), (b) => ({ bytes: b.size }));

    if (!compareWithOriginal) return { savedBytes: blob.size, originalBytes: file.size, identical: null };

    const [saved, original] = await Promise.all([blob.text(), file.text()]);
    return { savedBytes: blob.size, originalBytes: file.size, identical: saved === original };
  },

  async reopen() {
    if (!session.reopen) return;
    const text = await file.text();
    await stage("reopen", async () => {
      await session.reopen!(text);
      void scroller.scrollHeight;
      await nextFrame();
    });
  },

  placeCaret: (where: Where) => session.placeCaret(where),
  // ProseMirror learns about native caret moves from selectionchange, a frame or so later.
  async caretOrder() {
    await nextFrame();
    await nextFrame();
    return session.caretOrder();
  },
  contentSize: () => session.contentSize(),
  copyAllLength: () => session.copyAllLength?.() ?? null,

  /** Arm before a key press: time from the key event until the frame after it has painted. */
  armInput() {
    latency = new Promise((resolve) => {
      window.addEventListener("keydown", (event) => {
        const pressed = event.timeStamp;
        void (async () => {
          await nextFrame();
          resolve(performance.now() - pressed);
        })();
      }, { capture: true, once: true });
    });
  },
  inputLatency: () => latency!,

  /** Jump to a fraction of the document and wait until the viewport shows real content. */
  async scrollTo(fraction: number) {
    const started = performance.now();
    scroller.scrollTop = fraction * (scroller.scrollHeight - scroller.clientHeight);

    let stable = 0;

    while (stable < 2 && performance.now() - started < 10_000) {
      await nextFrame();
      stable = session.blankFraction() == 0 ? stable + 1 : 0;
    }

    return { ms: performance.now() - started, blank: session.blankFraction() };
  },
};

window.__perf = api;
