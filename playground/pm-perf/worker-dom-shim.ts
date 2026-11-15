// Vite resolves decode-named-character-reference to its "browser" build, which
// decodes entities through document.createElement — absent in a worker. The package's
// own "worker" build is a lookup in character-entities; this shim gives the browser
// build exactly that, so the worker parses entities the same way the Node build does.
import { characterEntities } from "character-entities";

if (typeof document == "undefined") {
  let html = "";
  // documentElement.style: prosemirror-view (pulled in via the highlight plugin) sniffs it at import.
  (globalThis as any).document = {
    documentElement: { style: {} },
    createElement: () => ({
      set innerHTML(value: string) { html = value; },
      get textContent() {
        const name = /^&(.*);$/.exec(html)?.[1];
        return name != null && Object.hasOwn(characterEntities, name) ? characterEntities[name as keyof typeof characterEntities] : html;
      },
    }),
  };
}
