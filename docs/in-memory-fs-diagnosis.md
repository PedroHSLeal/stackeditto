# In-memory FS — diagnosis and plan

Date: 2026-11-01
Branch: `feature/in-memory-fs`
Scope: `src/services/file-system/in-memory/**`, its call sites, and the memory behaviour of the whole open/read/save path.

Method: two review agents read the code independently; every claim below was then re-checked against the source, and the defects in §1.2–§1.6 were **confirmed empirically** with a throwaway spec (see §1.0). All byte-size multipliers in §3 are reasoned estimates, marked as such; everything else is read from code with `file:line`.

---

## 1. What is wrong today

### 1.0 Empirical confirmation

Baseline: `npx vitest run` → **9 tests, all green**, while the FS is broken as described below. The suite is green partly *because* its write-and-read-back test asserts nothing (§1.9).

A throwaway spec driving the real module (written, run, then deleted) produced:

| Probe | Spec expectation | Observed |
| --- | --- | --- |
| `getFileHandle("new.md", {create:true})` on a missing name | creates the file | **throws** |
| `getFileHandle("nope.md")` on a missing name | `DOMException` `NotFoundError` | `TypeError: Cannot read properties of undefined (reading 'kind')` |
| `getFileHandle("a.md", {create:true})` where `a.md` holds `"before"` | handle reads `"before"` | handle reads `""`, while the tree still reads `"before"` → **detached** |
| `typeof dirHandle.removeEntry` | `"function"` | `undefined` |
| `write("one")` then `write("two")` | `"onetwo"` | `"two"` |
| `isSameEntry(self)` / `resolve(sub)` | `true` / `["sub"]` | `false` / `[""]` |

### 1.1 The in-memory FS is unreachable from the UI — fix this first

`triggerWelcomeAction` (`src/App.vue:251`) selects the backend, then `populateDirectory(true)` calls `fs.openDirectory()` with **no argument** (`src/App.vue:139`). The in-memory `openDirectory(json)` returns `undefined` for a nullish structure (`in-memory/index.ts:7-8`), so `buildDirectoryStructure` returns `undefined` and `populateDirectory` bails out at `if (!project) return`.

Nothing in the app ever passes a `Structure`. The only callers that do are the specs. Consequence: **every defect in §1.2–§1.7 is currently masked** — the tour does nothing at all, so none of them can be observed from the UI yet. (`docs/code-review.md` §1.12)

### 1.2 `create: true` semantics are inverted in both getters

`in-memory/index.ts:47-65`:

| Case | Spec behaviour | Actual |
| --- | --- | --- |
| missing, no `create` | throw `NotFoundError` | reads `.kind` of `undefined` → `TypeError` |
| missing, `create: true` | create the entry, store it in the parent, return it | **throws `NotFoundError`** (`:50`, `:59`) |
| exists, `create: true` | return the existing handle, data intact | returns a **brand-new detached** handle (`:52`, `:61`) |
| exists as wrong kind | `TypeMismatchError` | correct, but only when the entry exists |

Correction to `docs/code-review.md` §1.1: it does **not** wipe directories. The original child stays in `args.children`; the caller simply receives a handle disconnected from the tree (and `children: []` is an array where the code expects an object map). The real failures are the throw and the detachment.

### 1.3 The tree is immutable — no create path ever writes back

No code path inserts into `args.children`. Even with §1.2 fixed, a created file or directory would exist only in the returned handle: the next `values()` iteration, and therefore the next workspace reload, would not list it.

### 1.4 `removeEntry` is not implemented at all

Absent from the handle literal, hidden by `as FileSystemDirectoryHandle` (`in-memory/index.ts:66`). Call sites:

- `deleteFile` (`utils/index.ts:89-91`) → unhandled `TypeError: removeEntry is not a function`.
- `deleteDirectory` (`utils/index.ts:93-101`) → the `catch` only recognises `INVALID_MODIFICATION_ERR` and returns `undefined` for everything else, so **deleting a folder silently does nothing**.
- Rename is emulated as copy + delete (`utils/index.ts:103-119`), so rename depends on both §1.2 and this.

### 1.5 `createWritable` is not a `FileSystemWritableFileStream`

`in-memory/index.ts:78-85`. `write()` does `args.content = [data.toString()]`:

- **whole-file replace on every write** — the real stream writes at a cursor, so two successive writes concatenate; here only the last chunk survives;
- `options`/`keepExistingData` ignored, no truncate-on-open;
- no `seek`, `truncate`, `abort`, `locked`, `getWriter`, or any `WritableStream` surface;
- `close()` is a no-op, so there is no atomic commit and `abort()` cannot discard;
- non-string chunks stringify to garbage: a `Blob` → `"[object Blob]"`, a `Uint8Array` → `"1,2,3"`, a `{type:"write",…}` command object → `"[object Object]"`.

It happens to work for the app's single current usage — `write(string)` then `close()` (`utils/index.ts:81-87`) — which is exactly why the gap has gone unnoticed.

### 1.6 Stubs that return wrong answers confidently

- `isSameEntry` always returns `false` (`:26-28`); spec returns `true` for the same entry, including `h.isSameEntry(h)`.
- `resolve` always returns `[""]` (`:29-31`); spec returns path segments, or `null` when not a descendant.
- Missing entirely: `queryPermission` / `requestPermission`, `move`, `[Symbol.asyncIterator]` (so `for await (const e of dirHandle)` fails — the app only uses `.values()` today), `createSyncAccessHandle`.
- The non-standard `isFile` / `isDirectory` flags (`:24-25`, `:73-74`) are legacy, and the fakes are plain objects, so `instanceof FileSystemFileHandle` is false.

No current call site touches these, so they are latent — they will bite whichever feature reaches for them first.

### 1.7 Child maps are plain objects, with no name validation

`traverseStructure` builds `{}` rather than `Object.create(null)` (`json-structure.ts:16`): a file named `__proto__` or `constructor` is hazardous, and integer-like names (`"1"`, `"2"`) sort ahead of string keys in `Object.keys`, changing iteration order. Duplicate sibling names silently collapse (`:23`, `:26`), entries with an unknown `kind` are silently dropped, and nothing rejects `""`, `"."`, `".."`, or names containing `/`, all of which the real API rejects with `TypeError`.

### 1.8 The type casts hide every one of these gaps

`as FileSystemDirectoryHandle` (`:66`), `as FileSystemFileHandle` (`:86`), `as FileSystemWritableFileStream` (`:84`). TypeScript accepts the assertions because the literals partially overlap the target types, so no missing member is ever reported. Replacing the casts with `satisfies` turns §1.4 and §1.6 into compile errors.

### 1.9 The tests do not cover any of it

`in-memory/index.spec.ts:91-116` — "read file content, write a new content and see the changed data" — computes `fileContentBefore`/`fileContentAfter` and **never calls `expect`**; it also never awaits `writable.close()`. `utils/index.spec.ts` asserts only `toBeDefined()`. Untested: every `create` combination, error types, multi-write, `keepExistingData`, write-visibility through the parent, nested directories in `buildDirectoryStructure`, the `EXCLUDED_DIRECTORIES` filter, iteration order.

---

## 2. What could go wrong (the structural risk)

The fake is a **second implementation of a browser API**, so app correctness now depends on reimplementation fidelity — and divergences only appear in tour mode, the one mode with no devtools filesystem to inspect.

Worse, the fidelity gap is shaped to hide itself: `getFiles` (`utils/index.ts:5-56`) only ever calls `values()` and `getFile()`, so the **initial read path works** while every mutation path is broken or missing. That is the classic "the demo is fine, then the user clicks something" failure. The physical backend also exercises paths the fake never will — permissions, user cancelling the picker, `lastModified` changes, concurrent writes — so passing tests against the fake say little about the real thing.

The whole-file-replace `write()` is the most insidious one: it trains the app into a save pattern that does not scale on the real API (see §4.3).

---

## 3. Memory implications

### 3.1 Verified mechanics

- **The walk is eager over the whole tree, but does not read content.** `getFiles` (`utils/index.ts:5-56`) calls `entry.getFile()` for every file and keeps the resulting `File` in the tree, decorated with four accessor properties (`handle`, `directoryHandle`, `extensionFile`, `webkitRelativePath`) whose getters capture `dirHandle`, `entry`, `file` and the full path string (`:14-34`). `.text()` is never called during the walk — content is lazy. Directory recursion is awaited serially (`:40`), but a directory's `getFile()` promises are all issued before `Promise.all` (`:50`), with no concurrency cap.
- **The whole tree is re-walked after every mutation**, twice for create and rename (`App.vue:299` + `:303`, `:330` + `:341`), once for delete (`:363`) and on "Recarregar Workspace".
- **The opened-file cache never evicts.** `services/opened-files/index.ts` is a module-global `Map` holding `{handler, full text}` per path; the only removal is the delete-file action (`App.vue:349`). It is not cleared when the workspace changes, and `openFile` calls `.text()` on *anything* the user clicks, including binaries (`App.vue:229`).
- **Nothing is ever released.** `grep` for `.dispose()`, `.destroy()`, `revokeObjectURL` across `src/` finds **no hits**; the only `onBeforeUnmount` handlers are in `Welcome.vue` and `Workspace.vue`, not the editors. So Monaco editors (plus their models and `onDidChangeContent` listeners), ProseMirror views, and extension blob URLs (`untrusted-code-extensions/modules.ts:16-19`) live for the page lifetime. `defaultView` (`services/prosemirror/index.ts:17`) pins the last view permanently.
- **Shiki loads eagerly at module scope** with a top-level `await getSingletonHighlighter(...)` for 6 grammars + a theme (`plugins/shiki-code-block.ts:14`), before any file is opened, and it blocks evaluation of every importer.
- **The fixtures exercise neither scenario**: `md/huge-file.md` is 610,659 bytes (~596 KB) and `md/markdown-it-test-file.md` is 5,846 bytes. Nothing covers tens of MB, nothing covers many files.

### 3.2 Scenario A — a few very large files (tens of MB)

With the **physical** backend a `File` is a disk-backed snapshot: nothing enters the renderer until `.text()`. With the **in-memory** backend, content is a JS string in a closure and every `getFile()` call does `new File(args.content, name)` (`in-memory/index.ts:76`), encoding a **fresh blob copy per call** — one retained per file in the tree, re-created on every re-walk. Floor is roughly 2× the corpus (string + blob) before anything is opened. *(Estimate.)*

Opening one 30 MB file then costs:

1. `.text()` in `openFile` → a 30 MB string cached **forever** (`App.vue:229`);
2. `.text()` again in `components/Editor.vue:32`, in both `onMounted` and `onUpdated` → a second copy held in `fileValue`, re-read on every re-render;
3. remark parse → mdast → ProseMirror doc → **full DOM render with no virtualization**, all synchronously on the main thread in one task.

The DOM dominates; order-of-magnitude 10–40× the raw text for an open document *(estimate, unmeasured)*. Saving builds a fresh mdast plus the output string, and `getProsemirrorText` (`services/prosemirror/index.ts:73-76`) then does one `.replace()` over the whole markdown string **per HTML block**, each allocating another full copy.

**First thing that breaks is not OOM — it is a multi-second main-thread freeze** on open (parse + DOM build), then sluggish typing. OOM arrives later, via the never-evicting cache plus never-disposed editors.

### 3.3 Scenario B — many small files (10k+)

Per-file retention is the `File` wrapper + 4 property descriptors and closures + the full path string + the handle: order 1.5–3 KB, so ~15–30 MB at 10k files and ~150–300 MB at 100k *(estimates)*. Not an OOM by itself. The costs that actually hurt:

- a flat 10k-file directory fires ~10k concurrent `getFile()` calls with no cap, while the walk is serial across directories — so open latency is dominated by round-trips;
- every create/rename/delete re-walks the entire tree (twice for create/rename), re-allocating every `File`;
- `TreeView` renders **every** file of an expanded directory with no virtualization (`TreeView.vue:12-15`);
- `renameDirectory` (`utils/index.ts:108-119`) reads and rewrites every file's full text, so renaming a deep folder is O(total bytes);
- `getAllFilesFromDirectory` (`utils/index.ts:145-159`) uses recursive `push(...spread)`, which can hit the engine argument limit on a very large flat directory;
- for the in-memory backend specifically, the `Structure` is one eagerly-materialised object, so "many small files" means the entire corpus sits in RAM as strings no matter what.

**First thing that breaks: a slow open, then UI sluggishness on expansion and on every edit-triggered re-walk.**

---

## 4. How to handle this in a browser

### 4.1 Stop hand-rolling the FSA fake

Two credible replacements. Both remove §1.2–§1.8 wholesale.

**(a) OPFS — the origin private file system.** `await navigator.storage.getDirectory()` returns a **real** `FileSystemDirectoryHandle`, the same class the picker yields. The physical implementation then works unchanged: `removeEntry`, `move`, real writable streams and permissions all come for free, with zero fidelity risk. It persists across reloads, and `createSyncAccessHandle()` in a worker gives fast synchronous reads. Costs: it is browser-managed storage rather than RAM (wipe it on teardown if the tour must leave no trace), it is quota-bound (`navigator.storage.estimate()`, `navigator.storage.persist()`), and it must be seeded on first run. This also directly serves the README's planned "protocolo de failsafe → salvar no opfs, em formato zip".

Under this option the `Structure` type and `traverseStructure` survive as the **seeder** — "in-memory" becomes "OPFS seeded from a JSON structure" — which is a far smaller contract than faking an API.

**(b) memfs `node-to-fsa`.** Already a dependency (`memfs@^4.17.0`), and `src/models/file-system.ts:1` already imports types from `memfs/lib/fsa`. I verified in the installed package that `lib/node-to-fsa` implements `removeEntry`, `move`, `createWritable` (a real `NodeFileSystemWritableFileStream`), `queryPermission`, `resolve`, `isSameEntry` and `createSyncAccessHandle` — precisely the set the fake is missing. `memfs()` gives an in-RAM Node fs; `NodeFileSystemDirectoryHandle` wraps it as an FSA tree. Cheapest correct replacement, and the right tool for the **tests** even if the app ships OPFS. Caveat: its handles are not `instanceof` the DOM classes, and the writable is Node-stream-backed — closer to spec than the fake by a wide margin, but worth pinning with the test matrix in §4.5.

Recommendation: **OPFS for the tour, memfs for the tests.** If the hand-rolled fake is kept anyway, at minimum swap the casts for `satisfies`, implement `removeEntry` and write-back into `args.children`, and make the writable positional.

### 4.2 Keep the tree metadata-only and lazy

- **Do not call `getFile()` during the walk.** Store `{name, kind, handle, path}` and resolve `File`/size on demand. This deletes the per-file `File` + four closures, and for the in-memory backend removes the per-file blob copy entirely.
- **Walk one level per expansion** instead of the whole workspace on open. If an eager index is wanted, run it in a Web Worker — FSA handles are structured-cloneable, so they can be transferred — and cap in-flight `getFile()` calls (e.g. 32) so 10k files does not fire 10k round-trips.
- **Patch the affected directory node after a mutation** instead of re-walking the tree; the duplicated reloads (`App.vue:299`+`303`, `330`+`341`) can go today, independent of everything else.
- **Virtualize the TreeView** (render only visible rows). Prerequisite for 10k files regardless of backend.
- For very large workspaces, index metadata in IndexedDB (Dexie is already in the study backlog) and keep the Pinia reactive layer to the visible slice rather than 100k reactive nodes.

### 4.3 Bound the text caches, and stop duplicating documents

- Give `openedFilesMap` an eviction policy — cap by total bytes (e.g. 32 MB) or LRU count — and clear it when the workspace changes. Today it is an unbounded page-lifetime leak of every file ever clicked.
- Keep **one** copy of an open document. Right now there are three: the cache value, `Editor.vue`'s `fileValue`, and the editor's own model. Let the editor model be the source of truth and hold only handles and dirty flags outside it; `Editor.vue` re-reading `.text()` in `onUpdated` is a redundant full read per re-render.
- Add the missing teardown: `editor.dispose()` + `model.dispose()` on Monaco unmount, `view.destroy()` on ProseMirror unmount, clear `defaultView`, and `URL.revokeObjectURL` when extension modules are re-registered or the page unloads.

### 4.4 Size thresholds and streaming for the large-file case

- **Gate the rich editor by file size.** Above a threshold (start around 2–5 MB and measure), open in Monaco/plaintext rather than ProseMirror: Monaco virtualizes its rendering, ProseMirror renders the whole document. This is the single highest-leverage change for scenario A.
- Use `file.slice()` / `file.stream()` + `TextDecoderStream` for previews, search and indexing instead of `.text()` on the whole file.
- Once the writable is real, **save positionally** — `truncate` + positional writes, or `keepExistingData: true` + `seek` — so a one-character edit does not rewrite 30 MB. The current fake teaches the opposite pattern.
- Move remark parse/serialize into a worker where practical, and do not run a full `getProsemirrorText()` serialize just to switch files — it is on the hot path in `openFile` today. Build the save output once rather than one `.replace()` pass per HTML block.

### 4.5 Pin the behaviour with tests, and measure instead of guessing

**Done — see `src/services/file-system/conformance/`.** The matrix is written once in `fsa-conformance.ts` and parameterised by backend:

```ts
runFsaConformance({ name, createRoot, knownGaps });
```

54 checks per subject (plus one guard test for mistyped gap ids), covering reads and iteration, the full `create` matrix and its error types, name validation, positional writes / `keepExistingData` / `truncate` / `seek` / binary and command chunks / commit-on-close, `removeEntry` across files and empty and non-empty directories, `isSameEntry` / `resolve`, and the app-level flows in `useFileSystemManipulation` (create → re-walk visibility, delete, rename round-trips, `EXCLUDED_DIRECTORIES`, path lookup).

A backend declares the ids it fails in `knownGaps`; those run under `test.fails`, so the suite stays green while a gap is open and **turns red the moment the gap is fixed** — the prompt to delete the id. Nothing is skipped silently, and a typo'd gap id fails its own guard test. (Verified: listing an already-passing check as a gap turns the suite red.)

Two subjects today:

- `in-memory.spec.ts` — the hand-rolled fake: **39 of 54 checks are declared gaps**, grouped by cause and cross-referenced to §1 above.
- `memfs-reference.spec.ts` — `memfs/node-to-fsa` as a known-good reference, which is what proves the matrix encodes real FSA behaviour rather than our fake's habits. Its only backend gap is async-iterability of the handle; its two other declared gaps are the `useFileSystemManipulation` bugs described next.

Note what the reference subject exposed: `app/renameDirectory-moves-children-and-drops-the-old-name` and `app/findFileHandler-returns-undefined-for-an-unknown-path` fail on **both** subjects, because those bugs are in `useFileSystemManipulation` itself (`code-review.md` §1.6 and §1.11), not in any backend. They are marked as gaps in both subject files with that attribution.

The assertion-free test at `in-memory/index.spec.ts:91-116` now asserts the before/after content and that the pre-write `File` snapshot does not change.

`vue-tsc --build` also independently flags two §1 items: `App.vue:139` (`openDirectory()` called with 0 of 1 arguments — the §1.1 bug) and `App.vue:170` (the unbound `text` method passed as module content).
- Add a playground (the harness and `__PLAYGROUNDS__` wiring already exist) that generates synthetic corpora — N files × M bytes — into the chosen backend and records walk/open timings plus `performance.measureUserAgentSpecificMemory()`. Every multiplier in §3 is an estimate; the 596 KB fixture exercises neither scenario, so these numbers should be replaced with measurements before any of them is designed around.
