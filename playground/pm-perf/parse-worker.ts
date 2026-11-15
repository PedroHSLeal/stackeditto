/// <reference lib="webworker" />
// Parses markdown off the main thread with the app's own pipeline and ships the
// ProseMirror document back as JSON (a Node cannot cross postMessage).
import "./worker-dom-shim";
import { markdownToProseMirror } from "@/services/markdown/remark/from-markdown-to-html";

postMessage({ ready: true });

onmessage = async (event: MessageEvent<string>) => {
  const started = performance.now();
  try {
    const doc = await markdownToProseMirror(event.data);
    const parsedAt = performance.now();
    const json = doc.toJSON();
    postMessage({ json, parseMs: parsedAt - started, toJsonMs: performance.now() - parsedAt });
  } catch (error: any) {
    postMessage({ error: String(error?.message ?? error) });
  }
};
