# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Stackeditto** (package name `stack-and-ditto`) — a browser-only, Obsidian-inspired markdown editor built with Vue 3 + Vite + TypeScript. There is no backend: the user picks a local folder with the File System Access API and the app reads/writes it directly. Deployed to GitHub Pages under base `/stackeditto/`.

`README.md` (Portuguese) is the roadmap/changelog of intent — it lists what is done and planned per version (v0.1, v0.2, study backlog). UI strings and many comments are Portuguese; code identifiers are English. Keep that split when adding features.

## Commands

```bash
npm install                 # node_modules is not committed
npm run dev                 # app dev server (index.html → src/main.ts)
npm run playground          # isolated experiment server (vite --mode playground, root ./playground)
npm run type-check          # vue-tsc --build (all three tsconfig project references)
npm run build               # type-check + build in parallel
npm run build-only          # vite build, no type-check (what CI deploys)
npm run test:unit           # vitest (watch mode)
npm run new-playground foo  # scaffold playground/foo + link it from playground/index.html
```

Single test runs (no wrapper script, call vitest directly):

```bash
npx vitest run src/services/file-system/in-memory/index.spec.ts
npx vitest run -t "should return a custom directory structure"
```

There is no lint script; `prettier` is installed but unconfigured. `.editorconfig` mandates 2-space indent, **CRLF**, and no final newline.

## Architecture

### Filesystem abstraction (the backbone)

`useFileSystem(impl)` in `src/services/file-system/index.ts` picks one of two backends, both of which expose only `openDirectory()` and `buildDirectoryStructure()`:

- **`"physical"`** (`fsa/`) — `showDirectoryPicker({ mode: "readwrite" })`, real WICG File System Access handles.
- **`"inMemory"`** (`in-memory/`) — hand-rolled objects cast to `FileSystemDirectoryHandle` / `FileSystemFileHandle`, built from a JSON `Structure` (`json-structure.ts`). Used by the Welcome "tour" path and as the test double for the FSA API.

Everything downstream speaks only the native handle interface, so a new backend just has to fake those handles convincingly. `src/services/file-system/utils/index.ts` (`useFileSystemManipulation()`) is backend-agnostic and holds *all* CRUD, path lookup and tree building:

- `getFiles()` walks a directory handle into a `CustomDirectory` tree, skipping `EXCLUDED_DIRECTORIES` (`.git`, `.obsidian`), and decorates each native `File` with `handle`, `directoryHandle`, `webkitRelativePath`, `extensionFile` getters via `Object.defineProperties` — that is what makes a `CustomFile` (`src/models/file-system.ts`).
- `populateDirectory()` splits the `.stackeditto` extension folder out of the tree into a separate `applicationDirectory`.
- `findFileHandler` / `findDirectoryHandler` resolve `webkitRelativePath` strings back to tree nodes; paths are `rootName/a/b.md` and lookups strip the first segment.

### State

Pinia (`src/store/file-system.ts`) holds only three things: `originalHandler` (root handle, typed `unknown` — call sites cast `as any`), `directory` (the tree) and `configDirectory` (the `.stackeditto` tree).

Everything else that must be shared is a **module-level `shallowRef`/object inside a `useXxx()` factory** — see `services/opened-files` (unsaved-edit cache keyed by relative path) and `untrusted-code-extensions/registry/html-blocks.ts`. Follow that pattern: state declared *inside* the factory body is per-caller and silently breaks cross-component sharing (`untrusted-code-extensions/modules.ts` is the broken counter-example).

`src/App.vue` is the orchestrator for every flow: opening/reloading a workspace, all file/directory CRUD, modal visibility, extension loading, tour wiring. After any mutation it calls `populateDirectory(false)`, which rebuilds the whole tree from disk — tree node identity is not stable across mutations, so never cache tree objects across a reload.

### Editors

`src/components/Editor.vue` dispatches on file extension: `.md` → the ProseMirror stack (`components/editors/prosemirror/*`), everything else → Monaco (`components/editors/monaco/Editor.vue`). Only ProseMirror content currently reaches the save path (`App.vue:saveFile` → `getProsemirrorText()`); Monaco's `change`/`save` emits have no listener.

Monaco workers are wired in `src/monaco/workers.ts` (imported for side effects by `main.ts`), and `services/untrusted-code-extensions/index.d.ts` is injected into Monaco as an extra lib so extension authors get autocomplete for `registerHtmlBlock`/`getModule`.

### Markdown ↔ ProseMirror round trip

`src/services/markdown/remark/` — **the filenames lie**: `from-markdown-to-html.ts` is markdown → ProseMirror and `from-html-to-markdown.ts` is ProseMirror → markdown. Both go through `unified` + `@handlewithcare/remark-prosemirror` with per-node handlers, against the custom schema in `services/prosemirror/schema.ts` (adds `html_block`, `table`/`thead`/`tbody`/`tr`/`td`/`th` on top of a basic-schema-like spec).

`services/prosemirror/index.ts` keeps a module-global `defaultView` (last mounted view wins) and builds state with input rules, keymaps, drop/gap cursor and the Shiki highlight plugin. `getProsemirrorText()` is the save serializer: ProseMirror exports each HTML block as the placeholder `</tag/>`, then `getProsemirrorText` scrapes the live DOM for elements carrying the namespaced attributes `stack-and-ditto:tag` / `stack-and-ditto:position`, calls each extension's `toMarkdown` hook, and substitutes the placeholders back. Any change to HTML-block handling has to touch all three places (schema, `from-html-to-markdown`, `getProsemirrorText`) plus `node-views/html-block.ts`.

### Extension system ("untrusted code")

Per-workspace folder `.stackeditto/` (constant `EXTENSION_STRUCTURE.EXTENSION_FOLDER`), seeded with `index.js` from `src/templates/imports-template.js`. On workspace open, `App.vue:executeUntrustedScripts()`:

- `.js` files → `scripts.ts`: comments stripped by regex, then `new Function("return async function(registerHtmlBlock, getModule) { ... }")` invoked with the registry and module getter.
- `.mjs` files → `modules.ts`: wrapped in blob URLs so extension code can `await import()` them.

Extensions register custom tags with `registerHtmlBlock({ htmlTag, init, toMarkdown, toHtml })`; `prosemirror/node-views/html-block.ts` then creates that element inside the document and `init`s it with the block's content. Tag/attribute parsing of the raw markdown lives in `prosemirror/tokens/html-tokens.ts`.

Despite the name, **none of this is sandboxed** — extension code and HTML-block attributes run with full page privileges, in a page that holds read/write access to the user's chosen folder. `docs/untrusted-code/` records the design reasoning (Portuguese) and the open questions about ESM imports and custom elements.

### Playground harness

`npm run playground` serves `./playground` as the Vite root with `base: "/"`; each subdirectory is a standalone mini-app with its own `index.html` + `main.ts` mounting into `#stackedit`, reachable at `localhost:5173/<dir>/`. `vite.config.ts` injects `__PLAYGROUNDS__` from `readdirSync("./playground")`, excluding names containing `.` or `_` (so `_utils_` stays out of the index). `playground/_utils_/transform-glob-into-structure.ts` converts an `import.meta.glob` result into the in-memory FS `Structure`, which is how playgrounds boot a fake workspace (see `infinite-canvas/Playground-old.vue`).

### Path aliases

Declared **twice** and must stay in sync — `vite.config.ts` `resolve.alias` and `tsconfig.app.json` `compilerOptions.paths`:

| alias | target |
| --- | --- |
| `@` | `./src` |
| `~` | `./node_modules` (used for deep imports, e.g. `~/memfs/lib/fsa` types, `~/prosemirror-view/style/...`) |
| `<md>` | `./md` (markdown fixtures: `huge-file.md`, `markdown-it-test-file.md`) |
| `<p>` | `./playground` |

### Tests

Vitest with `happy-dom`, config merged from `vite.config.ts` so aliases work. Specs are colocated as `*.spec.ts` (currently only under `services/file-system/`). The pattern for FSA-dependent code is to stub the global picker with the in-memory backend:

```ts
vi.stubGlobal("showDirectoryPicker", async () => await openDirectory(jsonStructure));
```

**Filesystem backends are judged by the conformance matrix in `src/services/file-system/conformance/`**, not by per-backend tests. `fsa-conformance.ts` holds 54 File System Access checks (reads and iteration, the `create` matrix and error types, name validation, positional writes, `removeEntry`, `isSameEntry`/`resolve`, plus the `useFileSystemManipulation` flows) and is parameterised by subject:

```ts
runFsaConformance({ name, createRoot, knownGaps });
```

`knownGaps` lists the check ids a backend is known to fail; those run under `test.fails`, so the suite stays green while a gap is open and **goes red when the gap is fixed** — that is the signal to delete the id, not to re-green the test. Add a backend by adding a subject file, never by loosening a check. `memfs-reference.spec.ts` is a known-good reference subject (`memfs/node-to-fsa`) kept so that a failing check can be told apart from a wrong check; nothing in `src/` imports it. The hand-rolled in-memory fake currently declares 39 gaps — `docs/in-memory-fs-diagnosis.md` explains each one.

### Deploy

`.github/workflows/deploy-gh-pages.yml` builds and publishes to GitHub Pages on pushes to the **`gh-pages`** branch (not `main`), using `npm run build-only` — type errors do not block a deploy.

## Things to know before changing code

- **`docs/code-review.md` is an audit of known bugs and smells (dated 2026-08-25) with file:line references.** Read the relevant entry before "fixing" surprising behavior or writing a regression test — several high-severity items (in-memory `get*Handle` inverted `create` semantics, swapped args in `registerUntrustedModules`, unsaved-content loss on file switch, missing `history()` plugin, nested-delete targeting the root handle) are documented there and may still be open.
- Branding is inconsistent by accident, not by design: package `stack-and-ditto`, Vite base and extension folder `stackeditto`/`.stackeditto`, DOM mount id `#stackedit`, attribute namespace `stack-and-ditto`. Match whatever the surrounding code uses rather than normalizing.
- Styling is almost entirely inline `style` attributes with a few CSS variables (`--primary`, `--secondary`, `--terciary`) from `src/main.scss`; `docs/pallete.md` holds the palette in every format.
- Composables are plain factory functions returning an object of functions (no `ref` arguments, no Vue lifecycle inside); keep new services in that shape.
