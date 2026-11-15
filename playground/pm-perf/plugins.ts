import { baseKeymap } from "prosemirror-commands";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { keymap } from "prosemirror-keymap";
import type { Plugin } from "prosemirror-state";

import { defaultNodeViews, mySchema } from "@/services/prosemirror";
import { buildInputRules } from "@/services/prosemirror/input-rules";
import { buildKeymap } from "prosemirror-example-setup";
import { highlightPlugin } from "@/services/prosemirror/plugins/shiki-code-block";
import { registerUntrustedHtmlBlock } from "@/services/untrusted-code-extensions";

import { incrementalHighlightPlugin } from "./incremental-highlight";
import { viewportHighlightPlugin } from "./viewport-highlight";
import type { PluginSet } from "./types";

// A stand-in for a user extension, so the html-block path runs its hooks.
registerUntrustedHtmlBlock({
  htmlTag: "x-perf-block",
  init: (element, content) => { element.textContent = content; },
  toMarkdown: (_container, element) => element?.textContent ?? "",
  toHtml: () => { },
});

const inputRules = () => buildInputRules(mySchema);
const keymaps = () => [keymap(baseKeymap), keymap(buildKeymap(mySchema))];
const cursors = () => [dropCursor(), gapCursor()];

/**
 * "all" MUST mirror the plugin list in buildProsemirrorState
 * (src/services/prosemirror/index.ts). It is rebuilt here so parsing and state
 * creation can be timed apart; the "reopen" stage runs the real function.
 */
export function pluginsFor(set: PluginSet, noHighlight = false): Plugin[] {
  const highlight = (): Plugin[] => (noHighlight ? [] : [highlightPlugin]);
  const incremental = (): Plugin[] => (noHighlight ? [] : [incrementalHighlightPlugin()]);
  const viewport = (): Plugin[] => (noHighlight ? [] : [viewportHighlightPlugin()]);

  switch (set) {
    case "none": return [];
    case "input-rules": return [inputRules()];
    case "keymaps": return keymaps();
    case "cursors": return cursors();
    case "highlight": return highlight();
    case "html-nodeview": return [];
    case "all-no-highlight": return [inputRules(), ...keymaps(), ...cursors()];
    case "all-incremental-highlight": return [inputRules(), ...keymaps(), ...cursors(), ...incremental()];
    case "all-viewport-highlight": return [inputRules(), ...keymaps(), ...cursors(), ...viewport()];
    case "all": return [inputRules(), ...keymaps(), ...cursors(), ...highlight()];
  }
}

export const nodeViewsFor = (set: PluginSet) =>
  set == "all" || set == "all-no-highlight" || set == "all-incremental-highlight" || set == "all-viewport-highlight" || set == "html-nodeview" ? defaultNodeViews : {};
