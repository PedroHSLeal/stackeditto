import { useFileSystem } from "../in-memory";
import { runFsaConformance } from "./fsa-conformance";

/**
 * The hand-rolled in-memory fake, measured against the matrix.
 *
 * `knownGaps` is the live inventory of how far the fake is from the browser API.
 * Each id runs under `test.fails`, so:
 *   - the suite stays green while a gap is open;
 *   - fixing a gap turns its test RED ("expected to fail, but passed"), which is
 *     the prompt to delete the id from this list.
 *
 * Grouped by cause, cross-referenced to docs/in-memory-fs-diagnosis.md.
 */
runFsaConformance({
  name: "hand-rolled in-memory fake",
  createRoot: async (structure) => (await useFileSystem().openDirectory(structure))!,
  knownGaps: [
    // §1.2 — create semantics inverted: missing+create throws, missing without
    // create reads `.kind` off undefined (TypeError, not NotFoundError), and
    // existing+create returns a detached empty handle.
    "get/missing-without-create-throws-NotFoundError",
    "get/missing-directory-without-create-throws-NotFoundError",
    "get/missing-with-create-creates-file",
    "get/missing-with-create-creates-directory",
    "get/existing-with-create-preserves-content",
    "get/existing-directory-with-create-preserves-children",

    // §1.3 — nothing is ever written back into args.children, so a created
    // entry is invisible to the parent and to any later walk.
    "get/created-file-is-listed-in-parent",
    "get/created-directory-is-listed-in-parent",
    "get/created-file-is-retrievable-again",

    // §1.7 — no name validation at all.
    "get/rejects-empty-name",
    "get/rejects-dot-name",
    "get/rejects-dotdot-name",
    "get/rejects-name-with-separator",

    // §1.5 — createWritable is a whole-file replace, not a positional stream.
    "write/two-writes-concatenate-at-cursor",
    "write/keepExistingData-preserves-tail",
    "write/seek-then-write-is-positional",
    "write/truncate-shrinks-file",
    "write/accepts-command-objects",
    "write/accepts-binary-chunks",
    "write/is-not-committed-before-close",

    // §1.4 — removeEntry does not exist.
    "remove/file-is-removed",
    "remove/empty-directory-is-removed",
    "remove/missing-entry-throws-NotFoundError",
    "remove/non-empty-directory-throws-InvalidModificationError",
    "remove/recursive-removes-non-empty-directory",

    // §1.6 — isSameEntry always false, resolve always [""], and FILE handles
    // do not define either method at all (only directory handles do).
    "identity/isSameEntry-self-is-true",
    "identity/isSameEntry-two-handles-same-file",
    "identity/isSameEntry-different-entries-is-false",
    "identity/resolve-returns-path-segments",
    "identity/resolve-returns-null-for-non-descendant",

    // §1.6 — the handle is not async-iterable.
    "read/async-iterable-directory-handle",

    // Consequences at app level: create/delete/rename all route through the
    // broken primitives above. deleteDirectory also cannot report "not empty",
    // because the missing removeEntry throws a TypeError that its catch
    // swallows into `undefined` instead of `false`.
    "app/createNewFile-then-walk-shows-it",
    "app/createNewDirectory-then-walk-shows-it",
    "app/deleteFile-removes-it",
    "app/deleteDirectory-recursive-removes-it",
    "app/deleteDirectory-reports-false-for-non-empty-without-recursive",
    "app/renameFile-moves-content-and-drops-the-old-name",

    // NOT backend gaps — these two fail on a spec-correct backend too, because
    // the bug is in useFileSystemManipulation itself:
    //   renameDirectory copies without removing the source (code-review §1.6)
    //   findFileHandler throws on an unknown path instead of returning
    //   undefined (code-review §1.11)
    "app/renameDirectory-moves-children-and-drops-the-old-name",
    "app/findFileHandler-returns-undefined-for-an-unknown-path",
  ],
});
