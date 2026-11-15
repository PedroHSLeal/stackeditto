# Code Review — Bugs & Code Smells

Date: 2026-08-25
Scope: `src/`, config files, tests.

Severity legend: 🔴 high (likely bug / data loss / security), 🟠 medium (bug under common conditions or clear design flaw), 🟡 low (smell / maintainability).

---

## 1. Bugs

### 1.1 In-memory FS: `get{File,Directory}Handle` create logic is inverted
`src/services/file-system/in-memory/index.ts:47-65`

- `if (!directory && !!options?.create) throw new DOMException("", "NotFoundError")` — when the entry **doesn't exist and `create: true`**, it throws instead of creating. The exact opposite of the spec.
- `if (options?.create) return createDirectoryHandle({ name, children: [] })` — when the entry **does exist** and `create: true`, a brand-new **empty** handle is returned, silently discarding all existing children. Same for `getFileHandle`, which replaces an existing file with empty content.

Net effect: `createNewFile` / `createNewDirectory` against the in-memory FS (the "Tour" mode) either throws or wipes directories.

### 1.2 `registerUntrustedModules` passes arguments swapped
`src/services/untrusted-code-extensions/modules.ts:11`

```ts
registerUntrustedModule(path, text);
// signature: registerUntrustedModule(scriptContent, scriptPath, ...)
```

The **path** becomes the blob content (the "code") and the **file contents** become the map key. `getModule(path)` can therefore never resolve. Additionally, `modulesMap` is created **per call** of `useUntrustedModules()` — App.vue and scripts.ts each instantiate their own `useUntrustedModules()`, so even with correct arguments the registry and the reader would look at different maps (compare with `registry/html-blocks.ts` and `opened-files`, which correctly use module-level state).

### 1.3 `App.vue` passes the *function* `text` instead of file contents
`src/App.vue:162-163`

```ts
.map(({ text, webkitRelativePath }) => ({ text: text, webkitRelativePath }));
```

`text` here is `File.prototype.text` (a method), destructured off the file — it is never awaited, and as an unbound method it would throw `Illegal invocation` if called. The registered "module content" ends up being the function's source string. Should be `.map(async (f) => ({ text: await f.text(), ... }))`.

### 1.4 Unsaved editor content is lost when opening a *new* file
`src/App.vue:226-229`

`openFile()` only persists the current editor text when the clicked file is **already open** (`hasFile(...)`). When switching to a file opened for the first time, the branch stores the *new file's disk text* and never calls `getProsemirrorText()` for the file being left — all edits made since it was opened vanish from the `openedFiles` cache and are silently discarded when the editor state is rebuilt.

### 1.5 Saving while a Monaco (non-markdown) file is open writes the wrong content
`src/App.vue:173-175` + `src/services/prosemirror/index.ts:56-79`

`saveFile()` always serializes the **ProseMirror** view (`getProsemirrorText()`), even when the currently open file is a `.js`/`.json` file being edited in Monaco. Result: the last markdown document gets written over the non-markdown file. Monaco's own `save`/`change` events (`monaco/Editor.vue:24,37-38`) are emitted but **nobody listens** — Monaco edits never reach the opened-files cache at all.

### 1.6 `renameDirectory` never deletes the source directory
`src/services/file-system/utils/index.ts:108-119`

It copies entries into the new directory but never removes the original — it's a copy, not a rename. `App.vue:317-336` compensates with an awkward copy → reload → `deleteDirectory` → reload dance (and reloads the workspace **twice** in the process, see 3.5).

### 1.7 Deleting a nested directory targets the workspace root
`src/App.vue:356-358`

```ts
await fsImpl.deleteDirectory(store.$state.originalHandler as any, resource.handle, true);
```

`removeEntry` is called on the **root** handle for any directory, regardless of depth. A nested directory either throws `NotFoundError` (unhandled → loading modal never closes via this path) or deletes an unrelated **top-level** entry that happens to share the name.

### 1.8 `getProsemirrorText` placeholder replacement only replaces the first occurrence
`src/services/prosemirror/index.ts:73-76`

`markdownContent.replace(`</${tag}/>`, ...)` with a string argument replaces **only the first** occurrence. Two HTML blocks with the same tag (e.g. two `<strudel-editor>` blocks) → the second placeholder survives into the saved markdown, corrupting the file. The whole `</tag/>` placeholder round-trip (see 1.9) is fragile.

### 1.9 Markdown round-trip loses HTML block content
`src/services/markdown/remark/from-html-to-markdown.ts:35`

```ts
html_block: fromPmNode("html", node => ({ value: `</${node.attrs.params.tag}/>` }))
```

The exported markdown for an HTML block is literally a malformed closing tag (`</strudel-editor/>`). Original attributes and inner content are dropped from the document model itself; recovery depends entirely on the runtime DOM scrape in `getProsemirrorText`. Also, `thead/tbody/tr/td/th` and the `code` (inline) / `s` marks have no export handlers, so tables/inline-code/strikethrough likely don't survive markdown export either.

### 1.10 Undo/redo bound but history plugin never installed
`src/services/prosemirror/index.ts:37-47` vs `src/services/prosemirror/keymaps.ts:48-50`

`buildProsemirrorState` installs input rules, keymaps, drop/gap cursor, highlight — but **not** `history()` from `prosemirror-history` (which is a dependency and whose `undo`/`redo` are bound to `Mod-z`/`Shift-Mod-z`). Undo/redo silently does nothing.

### 1.11 `findFileHandler` / `findDirectoryHandler` crash on unknown paths
`src/services/file-system/utils/index.ts:129,141`

`findFileHandler(parent!, ...)` — when the first path segment doesn't match any child directory, `parent` is `undefined` and the recursive call throws `TypeError: Cannot read properties of undefined`. Callers (e.g. `App.vue:246`) don't catch it. A stale `webkitRelativePath` after a rename/delete turns this into a hard crash.

### 1.12 Tour button does nothing
`src/App.vue:251-264` + `src/services/file-system/in-memory/index.ts:7-12`

`triggerWelcomeAction('tour')` sets `fs = useFileSystem("inMemory")` and calls `populateDirectory(true)` → `fs.openDirectory()` **with no argument**. The in-memory `openDirectory(json)` requires a JSON structure; with `undefined` it resolves `undefined` and the flow silently aborts. No tour data is ever passed in.

### 1.13 `useMouse` drops the first event and can return `undefined`
`src/hooks/pointer.ts:6-15`

On the first `setEvent(x, y)` call, the map has no entry yet, so a ref is created with `{x: null, y: null}` and the actual `x`/`y` are thrown away. `getEvent()` before the first set returns `undefined` (untyped as such).

### 1.14 `TreeView.showContent` grows unbounded and desynchronizes
`src/components/TreeView/TreeView.vue:36-41`

The watcher pushes `false` for every directory on **every** change of `props.directory` without resetting. After a workspace reload (which happens after every create/rename/delete), the array doubles, and because `reloadDirectoryStructure` rebuilds `directory` objects, expanded-state indices no longer correspond to the right folders. Should be `showContent.length = 0` before repopulating (or keyed by path).

### 1.15 Top-menu list buttons do nothing on a selection
`src/models/top-menu.ts:40-68`

`setBulletedListAction` / `setOrderedListAction` only implement the `selection.empty` branch — clicking them with text selected is a no-op (no `wrapInList` for the non-empty case).

### 1.16 Naive comment-stripping corrupts scripts containing URLs
`src/services/untrusted-code-extensions/scripts.ts:14-16`

`^(?:\s|\t)*\/\/.*$` deletes `//...` **inside string literals** too — any extension containing `"https://..."` (like the shipped `imports-template.js`, which imports from `https://unpkg.com/...`) gets its URL truncated to `https:`. The multi-line regex also mis-handles `/*` inside strings. Additionally, `loadUntrustedScript(...)` inside the loop is async but **not awaited**, so registration errors become unhandled rejections and ordering is not guaranteed.

### 1.17 HTML-block node view enables XSS from untrusted markdown
`src/services/prosemirror/node-views/html-block.ts:20-26`

`document.createElement(node.attrs.params.tag)` + `setAttribute(key, value)` with arbitrary tag/attributes parsed from the opened markdown (`html-tokens.ts` accepts e.g. `onerror="..."`). Inline event-handler attributes set via `setAttribute` **do** fire, so merely opening a malicious `.md` file executes script in the app origin — which has read/write access to the user-picked workspace directory. The whole "untrusted" extension pipeline (`new Function(...)` at `scripts.ts:8`) likewise runs with full page privileges; nothing is actually sandboxed despite the naming.

---

## 2. More potential bugs

- 🟠 **Non-atomic rename** — `renameFile` (`utils/index.ts:103-106`) creates the new file before deleting the old one; a failure mid-way leaves duplicates, and an existing target file is silently overwritten. Rename of a file with unsaved in-memory edits reads the **disk** content (`App.vue:315`), so unsaved changes are lost on rename.
- 🟠 **Stale node-view positions** — `HtmlBlockView` caches `getPos()` once at construction (`html-block.ts:14`); the `position` attribute used as a map key in `getProsemirrorText` goes stale after edits above the block.
- 🟠 **Monaco `onUpdated` resets value on every re-render** — `monaco/Editor.vue:44-53` calls `setValue(props.value)` on any component update, moving the cursor to the start and re-triggering `onDidChangeContent` → `change` emit (feedback-loop risk).
- 🟠 **No dispose** — neither the ProseMirror view (`prosemirror/Editor.vue`) nor the Monaco editor (`monaco/Editor.vue`) is destroyed on unmount (`view.destroy()` / `editor.dispose()`); `defaultView` in `services/prosemirror/index.ts:17` is a mutable module-global that the last mounted view wins.
- 🟠 **`openFile` race** — `Editor.vue:30-38` (`async` reads in `onMounted`/`onUpdated`) has no guard against out-of-order completion when files are switched quickly; the loser can overwrite `fileValue` with stale text.
- 🟠 **`deleteDirectory` swallows errors** — `utils/index.ts:93-101` returns `undefined` for every error that isn't `INVALID_MODIFICATION_ERR`; callers can't distinguish "not empty" from "permission denied"/"not found".
- 🟠 **Empty `showDirectoryPicker` cancel** — `App.vue:139` patches `originalHandler` to `undefined` even when the user cancels the picker; state is mutated for a no-op action.
- 🟡 **`code` mark `toDOM: ["code", 0]`** — `schema.ts:161-165`: mark DOM specs must not contain a content hole (`0`); the basic schema uses `["code"]`.
- 🟡 **`list_item` content is `(paragraph)+`** — `schema.ts:76`: nested lists, code blocks inside list items, etc. don't fit the schema; markdown import of nested lists will drop/flatten them.
- 🟡 **`code_block` stores content twice** — both as child text and an unused `content` attr (`schema.ts:90-93`).
- 🟡 **Attr regexes are fragile** — `html-tokens.ts:21-24` splits attributes on spaces (breaks `class="a b"`) and strips only the first quote; start/finish tags are not checked to match (`<a>..</b>` parses fine).
- 🟡 **`regex.exec(content)!` followed by `if (!result)`** — `html-tokens.ts:17-19`: the non-null assertion contradicts the very next check.
- 🟡 **Top-level `await` in module** — `shiki-code-block.ts:14` blocks the entire app bootstrap on highlighter + grammar loading; language matching is exact-match only (`js`, `ts` aliases → plaintext).
- 🟡 **Welcome.vue timer** — `setTimeout` inside `setInterval` keeps firing after unmount (only the interval is cleared), and `clearTimeout(timeoutId)` inside its own callback is useless.
- 🟡 **`object URLs never revoked** — `modules.ts:17` creates a blob URL per module and never calls `URL.revokeObjectURL`.

---

## 3. Code smells / maintainability

1. **App.vue is a god component** (375 lines): file opening/caching, all CRUD flows, modals state, extension loading and tour wiring all live in one component. Most of the `async function showXxxModal(...)` functions don't await anything and shouldn't be async.
2. **Duplicated reload calls**: `saveNewFileOrDirectory` calls `populateDirectory(false)` **and** `reloadDirectoryStructure()` (which is `populateDirectory(false)` again) — `App.vue:299-303`; `renameResource` reloads twice too (`App.vue:330,341`).
3. **Copy-paste input rules**: `strongRule` / `italicRule` / `strikethroughRule` (`input-rules.ts:77-129`) are tripled, with all variables still named `DoubleStars`. One parameterized factory would do. `keymaps.ts` is a verbatim copy of `prosemirror-example-setup`'s keymap with the original doc-comment retained.
4. **Dead code everywhere**: empty `onMounted(() => {})` (`App.vue:133`, `TreeView.vue:27`, `NewFileOrDirectoryModal.vue:44`); unused `showEditor` ref (`App.vue:117`); unused `onBeforeUpdate` import (`Editor.vue:13`); unused `onMounted` import (`DropdownMenu.vue`); unused `cursorAtNode` (`keymaps.ts:55`); commented-out types (`models/file-system.ts:24-30`); `isChosenDir` parameter that is always `false` (`App.vue:191`); `DirectoryItem.vue` emits `selected` that nobody listens to; `showEditor`/`selectedDirectory` write-only state.
5. **Misleading names**:
   - `from-markdown-to-html.ts` / `from-html-to-markdown.ts` convert markdown ↔ ProseMirror, not HTML.
   - `isInputValid` computed actually means *invalid* (`RenameResourceModal.vue:34`, `NewFileOrDirectoryModal.vue:40`) — `:disabled="isInputValid"` reads backwards.
   - `calcuteCountOfFilesAndDirectories` — typo, and it's needlessly `async`.
   - `populateDirectory` in utils actually *removes* the extension dir; local var `stackeditoDirectoryIndex` typo.
   - Project is named `stack-and-ditto` in package.json but branded `stackeditto`/`.stackeditto`/`stack-and-ditto` (namespace, base path) inconsistently.
6. **Weak typing / `as any` erasure**: `store.originalHandler` is `unknown` and cast with `as any` at every use (`App.vue:142,183,357`); `getUntrustedHtmlBlock` declares a non-nullable return but returns `undefined` (`registry/html-blocks.ts:25`); in-memory FS handles are big `as FileSystemDirectoryHandle` object literals. `file-system/index.ts` overloads end in `... | undefined` forcing `!` on callers even for the default implementation.
7. **Duplicated `PATTERN` regex** for name validation in both resource modals; no shared validation; it accepts `..`-ish names? (it accepts dots, so `..` passes — names like `..` could be problematic, though FSA handles them literally).
8. **Inline styles as styling strategy** — nearly every component carries long inline `style` strings instead of classes; modal widths are hardcoded (900px) and won't fit small screens.
9. **Duplicate DOM ids** — `id="directory"`/`id="file"`/`id="entry"`/`#topbar` repeat across recursive tree items and modals.
10. **`withDefaults` misuse** — `TreeView.vue:29`: default factory `(props) => props.showFiles ?? true` references the prop itself.
11. **`getFiles` mixes concerns** — recursion + property definition via `Object.defineProperties` on `File` instances with getters; sorting files but comparing `handle.name` with `!` on one side only (`utils/index.ts:52-53`).
12. **UI language mixing** — Portuguese UI strings/TODOs (`"nao funcionou :("` is even inserted into documents by `linkRule`, `input-rules.ts:144`) with English code comments.
13. **Tests are weak** — the in-memory "write and read back" test has **no assertions** (`in-memory/index.spec.ts:91-116`); the utils test only asserts `toBeDefined()`; both spec files are far from covering the flows above (and given 1.1, `createWritable`-based flows would fail).
14. **Dropdown/modal ergonomics** — `DropdownMenu` has no click-outside/Escape handling; `Modal` overlay is not closable by clicking the backdrop; `DeleteResourceModal` computes `resourceName` before `isFileOperation` is declared (works only due to lazy evaluation).
15. **Error handling is `console.error` or nothing** — prosemirror editor swallows build/update errors, `openFile` on missing path sets `fileValue = undefined` silently, extension script errors vanish (1.16).

---

## 4. Suggested priorities

1. Fix the in-memory FS handle inversion (1.1) and the module registration pipeline (1.2, 1.3) — the extension system cannot work at all as written.
2. Fix the save/open lifecycle (1.4, 1.5) — these cause **user data loss**.
3. Fix nested delete (1.7) and the placeholder replace-all bug (1.8) — file corruption risks.
4. Add the `history()` plugin (1.10) — one-liner.
5. Sanitize or iframe-sandbox HTML blocks and document that "untrusted" extensions run with full privileges (1.17).
6. Harden `findFileHandler`/`findDirectoryHandler` and `deleteDirectory` error paths.
7. Refactor pass: split App.vue, deduplicate input rules, remove dead code, strengthen tests.
