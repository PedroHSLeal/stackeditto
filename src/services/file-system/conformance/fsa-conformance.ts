import { describe, expect, test } from "vitest";

import { EXCLUDED_DIRECTORIES, type CustomDirectory } from "@/models/file-system";
import type { Structure } from "../in-memory/json-structure";
import { useFileSystemManipulation } from "../utils";

/**
 * Backend-agnostic conformance matrix for the File System Access API.
 *
 * Every candidate backend (the hand-rolled in-memory fake, memfs/node-to-fsa,
 * OPFS, ...) is measured against the SAME checks, so "does this backend behave
 * like the browser?" has one answer instead of one per implementation.
 *
 * Each check has a stable id. A backend declares the ids it is known to fail in
 * `knownGaps`; those run under `test.fails`, which keeps the suite green while
 * the gap exists AND turns red the moment the gap is fixed (that is the signal
 * to delete the id from the list). Nothing is silently skipped.
 *
 * See docs/in-memory-fs-diagnosis.md for what each gap means.
 */

export type ConformanceSubject = {
  /** Display name for the describe block. */
  name: string;
  /** Build a root directory handle pre-populated with `structure`. */
  createRoot: (structure: Structure) => Promise<FileSystemDirectoryHandle>;
  /** Check ids this backend is known to fail, with a reason in the subject file. */
  knownGaps?: readonly string[];
};

/** Seed tree used by every check that does not build its own. */
export const SEED: Structure = {
  kind: "directory",
  name: "root",
  children: [
    { kind: "file", name: "a.md", content: "before" },
    { kind: "file", name: "b.txt", content: "bee" },
    {
      kind: "directory",
      name: "sub",
      children: [
        { kind: "file", name: "nested.md", content: "deep" },
        { kind: "directory", name: "empty", children: [] },
      ],
    },
    { kind: "directory", name: ".git", children: [{ kind: "file", name: "HEAD", content: "ref" }] },
  ],
};

async function readHandle(handle: FileSystemFileHandle): Promise<string> {
  return await (await handle.getFile()).text();
}

/** Resolve a rejection to the thrown value, or fail if the promise resolves. */
async function rejection(promise: Promise<unknown>): Promise<any> {
  const outcome = await promise.then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  );

  if (outcome.ok) expect.fail(`expected a rejection, got ${JSON.stringify(outcome.value)}`);

  return outcome.error;
}

/** The spec throws DOMExceptions with specific `name`s; assert on the name, not the class. */
async function rejectsWithName(promise: Promise<unknown>, expectedName: string) {
  const error = await rejection(promise);
  expect(`${error?.name}: ${error?.message}`).toContain(expectedName);
}

async function listNames(directory: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of directory.values()) names.push(entry.name);
  return names.sort();
}

export function runFsaConformance(subject: ConformanceSubject) {
  const gaps = new Set(subject.knownGaps ?? []);
  const declared = new Set<string>();

  /** Register one check. Known gaps run inverted via `test.fails`. */
  function check(id: string, fn: () => Promise<void>) {
    declared.add(id);

    if (gaps.has(id)) test.fails(`${id}  [known gap]`, fn);
    else test(id, fn);
  }

  describe(`FSA conformance: ${subject.name}`, () => {
    const root = () => subject.createRoot(SEED);

    describe("reading the seeded tree", () => {
      check("read/values-lists-entries", async () => {
        expect(await listNames(await root())).toEqual([".git", "a.md", "b.txt", "sub"]);
      });

      check("read/kind-and-name", async () => {
        const dir = await root();
        const file = await dir.getFileHandle("a.md");
        const sub = await dir.getDirectoryHandle("sub");

        expect(file.kind).toBe("file");
        expect(file.name).toBe("a.md");
        expect(sub.kind).toBe("directory");
        expect(sub.name).toBe("sub");
      });

      check("read/keys-lists-names", async () => {
        const keys: string[] = [];
        for await (const key of (await root()).keys()) keys.push(key);
        expect(keys.sort()).toEqual([".git", "a.md", "b.txt", "sub"]);
      });

      check("read/entries-yields-name-handle-pairs", async () => {
        const dir = await root();
        const pairs: [string, string][] = [];

        for await (const [name, handle] of dir.entries()) pairs.push([name, handle.kind]);

        expect(pairs.sort()).toEqual([
          [".git", "directory"],
          ["a.md", "file"],
          ["b.txt", "file"],
          ["sub", "directory"],
        ]);
      });

      check("read/async-iterable-directory-handle", async () => {
        const dir = await root();
        const names: string[] = [];

        // The spec makes the handle itself async-iterable over [name, handle].
        for await (const [name] of dir as unknown as AsyncIterable<[string, FileSystemHandle]>) {
          names.push(name);
        }

        expect(names.sort()).toEqual([".git", "a.md", "b.txt", "sub"]);
      });

      check("read/file-content", async () => {
        expect(await readHandle(await (await root()).getFileHandle("a.md"))).toBe("before");
      });

      check("read/nested-directory-content", async () => {
        const sub = await (await root()).getDirectoryHandle("sub");
        expect(await readHandle(await sub.getFileHandle("nested.md"))).toBe("deep");
      });

      check("read/file-size-matches-content", async () => {
        const file = await (await (await root()).getFileHandle("a.md")).getFile();
        expect(file.size).toBe("before".length);
      });
    });

    describe("getFileHandle / getDirectoryHandle", () => {
      check("get/missing-without-create-throws-NotFoundError", async () => {
        await rejectsWithName((await root()).getFileHandle("nope.md"), "NotFoundError");
      });

      check("get/missing-directory-without-create-throws-NotFoundError", async () => {
        await rejectsWithName((await root()).getDirectoryHandle("nope"), "NotFoundError");
      });

      check("get/missing-with-create-creates-file", async () => {
        const handle = await (await root()).getFileHandle("new.md", { create: true });
        expect(handle.kind).toBe("file");
        expect(await readHandle(handle)).toBe("");
      });

      check("get/missing-with-create-creates-directory", async () => {
        const handle = await (await root()).getDirectoryHandle("newdir", { create: true });
        expect(handle.kind).toBe("directory");
        expect(await listNames(handle)).toEqual([]);
      });

      check("get/created-file-is-listed-in-parent", async () => {
        const dir = await root();
        await dir.getFileHandle("new.md", { create: true });
        expect(await listNames(dir)).toContain("new.md");
      });

      check("get/created-directory-is-listed-in-parent", async () => {
        const dir = await root();
        await dir.getDirectoryHandle("newdir", { create: true });
        expect(await listNames(dir)).toContain("newdir");
      });

      check("get/created-file-is-retrievable-again", async () => {
        const dir = await root();
        await dir.getFileHandle("new.md", { create: true });
        expect(await readHandle(await dir.getFileHandle("new.md"))).toBe("");
      });

      check("get/existing-with-create-preserves-content", async () => {
        const dir = await root();
        const handle = await dir.getFileHandle("a.md", { create: true });
        expect(await readHandle(handle)).toBe("before");
      });

      check("get/existing-directory-with-create-preserves-children", async () => {
        const dir = await root();
        const sub = await dir.getDirectoryHandle("sub", { create: true });
        expect(await listNames(sub)).toEqual(["empty", "nested.md"]);
      });

      check("get/file-requested-as-directory-throws-TypeMismatchError", async () => {
        await rejectsWithName((await root()).getDirectoryHandle("a.md"), "TypeMismatchError");
      });

      check("get/directory-requested-as-file-throws-TypeMismatchError", async () => {
        await rejectsWithName((await root()).getFileHandle("sub"), "TypeMismatchError");
      });

      // These pass `create: true` deliberately. Without it a backend that merely
      // crashes while looking the name up also throws a TypeError, and the check
      // could not tell "validated the name" from "tripped over undefined".
      check("get/rejects-empty-name", async () => {
        await rejectsWithName((await root()).getFileHandle("", { create: true }), "TypeError");
      });

      check("get/rejects-dot-name", async () => {
        await rejectsWithName((await root()).getFileHandle(".", { create: true }), "TypeError");
      });

      check("get/rejects-dotdot-name", async () => {
        await rejectsWithName((await root()).getDirectoryHandle("..", { create: true }), "TypeError");
      });

      check("get/rejects-name-with-separator", async () => {
        await rejectsWithName((await root()).getFileHandle("sub/nested.md", { create: true }), "TypeError");
      });
    });

    describe("createWritable", () => {
      check("write/replaces-content-and-is-visible-via-fresh-handle", async () => {
        const dir = await root();
        const writable = await (await dir.getFileHandle("a.md")).createWritable();

        await writable.write("after");
        await writable.close();

        expect(await readHandle(await dir.getFileHandle("a.md"))).toBe("after");
      });

      check("write/truncates-on-open-by-default", async () => {
        const dir = await root();
        const writable = await (await dir.getFileHandle("a.md")).createWritable();

        await writable.write("x");
        await writable.close();

        // keepExistingData defaults to false, so the old "before" must be gone.
        expect(await readHandle(await dir.getFileHandle("a.md"))).toBe("x");
      });

      check("write/two-writes-concatenate-at-cursor", async () => {
        const dir = await root();
        const writable = await (await dir.getFileHandle("a.md")).createWritable();

        await writable.write("one");
        await writable.write("two");
        await writable.close();

        expect(await readHandle(await dir.getFileHandle("a.md"))).toBe("onetwo");
      });

      check("write/keepExistingData-preserves-tail", async () => {
        const dir = await root();
        const writable = await (await dir.getFileHandle("a.md")).createWritable({ keepExistingData: true });

        await writable.write("X");
        await writable.close();

        expect(await readHandle(await dir.getFileHandle("a.md"))).toBe("Xefore");
      });

      check("write/seek-then-write-is-positional", async () => {
        const dir = await root();
        const writable = await (await dir.getFileHandle("a.md")).createWritable({ keepExistingData: true });

        await writable.seek(3);
        await writable.write("XYZ");
        await writable.close();

        expect(await readHandle(await dir.getFileHandle("a.md"))).toBe("befXYZ");
      });

      check("write/truncate-shrinks-file", async () => {
        const dir = await root();
        const writable = await (await dir.getFileHandle("a.md")).createWritable({ keepExistingData: true });

        await writable.truncate(3);
        await writable.close();

        expect(await readHandle(await dir.getFileHandle("a.md"))).toBe("bef");
      });

      check("write/accepts-command-objects", async () => {
        const dir = await root();
        const writable = await (await dir.getFileHandle("a.md")).createWritable();

        await writable.write({ type: "write", position: 0, data: "zero" });
        await writable.close();

        expect(await readHandle(await dir.getFileHandle("a.md"))).toBe("zero");
      });

      check("write/accepts-binary-chunks", async () => {
        const dir = await root();
        const writable = await (await dir.getFileHandle("a.md")).createWritable();

        await writable.write(new TextEncoder().encode("bytes"));
        await writable.close();

        expect(await readHandle(await dir.getFileHandle("a.md"))).toBe("bytes");
      });

      check("write/is-not-committed-before-close", async () => {
        const dir = await root();
        const writable = await (await dir.getFileHandle("a.md")).createWritable();

        await writable.write("uncommitted");
        const duringWrite = await readHandle(await dir.getFileHandle("a.md"));
        await writable.close();

        expect(duringWrite).toBe("before");
      });
    });

    describe("removeEntry", () => {
      check("remove/file-is-removed", async () => {
        const dir = await root();
        await dir.removeEntry("a.md");
        expect(await listNames(dir)).not.toContain("a.md");
      });

      check("remove/empty-directory-is-removed", async () => {
        const sub = await (await root()).getDirectoryHandle("sub");
        await sub.removeEntry("empty");
        expect(await listNames(sub)).toEqual(["nested.md"]);
      });

      check("remove/missing-entry-throws-NotFoundError", async () => {
        await rejectsWithName((await root()).removeEntry("nope.md"), "NotFoundError");
      });

      check("remove/non-empty-directory-throws-InvalidModificationError", async () => {
        await rejectsWithName((await root()).removeEntry("sub"), "InvalidModificationError");
      });

      check("remove/recursive-removes-non-empty-directory", async () => {
        const dir = await root();
        await dir.removeEntry("sub", { recursive: true });
        expect(await listNames(dir)).not.toContain("sub");
      });
    });

    describe("identity and paths", () => {
      check("identity/isSameEntry-self-is-true", async () => {
        const dir = await root();
        expect(await dir.isSameEntry(dir)).toBe(true);
      });

      check("identity/isSameEntry-two-handles-same-file", async () => {
        const dir = await root();
        const first = await dir.getFileHandle("a.md");
        const second = await dir.getFileHandle("a.md");
        expect(await first.isSameEntry(second)).toBe(true);
      });

      check("identity/isSameEntry-different-entries-is-false", async () => {
        const dir = await root();
        const first = await dir.getFileHandle("a.md");
        const second = await dir.getFileHandle("b.txt");
        expect(await first.isSameEntry(second)).toBe(false);
      });

      check("identity/resolve-returns-path-segments", async () => {
        const dir = await root();
        const sub = await dir.getDirectoryHandle("sub");
        const nested = await sub.getFileHandle("nested.md");
        expect(await dir.resolve(nested)).toEqual(["sub", "nested.md"]);
      });

      check("identity/resolve-returns-null-for-non-descendant", async () => {
        const dir = await root();
        const sub = await dir.getDirectoryHandle("sub");
        // a.md is a sibling of `sub`, so it is not reachable from inside it.
        // (Comparing across two separately-created roots would not work for a
        // path-based backend, where both trees live at the same path.)
        const outside = await dir.getFileHandle("a.md");

        expect(await sub.resolve(outside)).toBeNull();
      });
    });

    // What useFileSystemManipulation() actually asks of a backend. These are the
    // flows the app exposes through App.vue, so a backend that passes the handle
    // checks above but fails here still breaks the UI.
    describe("app-level operations (useFileSystemManipulation)", () => {
      const fsImpl = useFileSystemManipulation();

      const walk = (handle: FileSystemDirectoryHandle): Promise<CustomDirectory> =>
        fsImpl.getFiles(handle, { webkitRelativePath: handle.name, handle, directories: [], files: [] });

      check("app/getFiles-builds-the-tree", async () => {
        const tree = await walk(await root());

        expect(tree.files.map((f) => f.handle.name)).toEqual(["a.md", "b.txt"]);
        expect(tree.directories.map((d) => d.handle.name)).toEqual(["sub"]);
        expect(tree.files[0].webkitRelativePath).toBe("root/a.md");
      });

      check("app/getFiles-skips-excluded-directories", async () => {
        const tree = await walk(await root());
        const names = tree.directories.map((d) => d.handle.name);

        for (const excluded of EXCLUDED_DIRECTORIES) expect(names).not.toContain(excluded);
      });

      check("app/createNewFile-then-walk-shows-it", async () => {
        const dir = await root();
        await fsImpl.createNewFile(dir, "created.md", "# hello");

        const tree = await walk(dir);
        const created = tree.files.find((f) => f.handle.name == "created.md");

        expect(created, "created.md should appear in a fresh walk").toBeDefined();
        expect(await created!.text()).toBe("# hello");
      });

      check("app/createNewDirectory-then-walk-shows-it", async () => {
        const dir = await root();
        await fsImpl.createNewDirectory(dir, "created-dir");

        const tree = await walk(dir);
        expect(tree.directories.map((d) => d.handle.name)).toContain("created-dir");
      });

      check("app/saveFile-persists-content", async () => {
        const dir = await root();
        await fsImpl.saveFile(await dir.getFileHandle("a.md"), "saved!");

        expect(await readHandle(await dir.getFileHandle("a.md"))).toBe("saved!");
      });

      check("app/deleteFile-removes-it", async () => {
        const dir = await root();
        await fsImpl.deleteFile(dir, "a.md");

        expect((await walk(dir)).files.map((f) => f.handle.name)).toEqual(["b.txt"]);
      });

      check("app/deleteDirectory-recursive-removes-it", async () => {
        const dir = await root();
        const removed = await fsImpl.deleteDirectory(dir, await dir.getDirectoryHandle("sub"), true);

        expect(removed).toBe(true);
        expect(await listNames(dir)).not.toContain("sub");
      });

      check("app/deleteDirectory-reports-false-for-non-empty-without-recursive", async () => {
        const dir = await root();
        const removed = await fsImpl.deleteDirectory(dir, await dir.getDirectoryHandle("sub"), false);

        expect(removed).toBe(false);
        expect(await listNames(dir)).toContain("sub");
      });

      check("app/renameFile-moves-content-and-drops-the-old-name", async () => {
        const dir = await root();
        await fsImpl.renameFile(dir, "a.md", "renamed.md", "before");

        const names = await listNames(dir);

        expect(names).toContain("renamed.md");
        expect(names).not.toContain("a.md");
        expect(await readHandle(await dir.getFileHandle("renamed.md"))).toBe("before");
      });

      check("app/renameDirectory-moves-children-and-drops-the-old-name", async () => {
        const dir = await root();
        await fsImpl.renameDirectory(dir, await dir.getDirectoryHandle("sub"), "renamed-sub");

        const names = await listNames(dir);

        expect(names).toContain("renamed-sub");
        expect(names, "rename must not leave the source behind").not.toContain("sub");

        const renamed = await dir.getDirectoryHandle("renamed-sub");
        expect(await readHandle(await renamed.getFileHandle("nested.md"))).toBe("deep");
      });

      check("app/findFileHandler-resolves-a-nested-path", async () => {
        const tree = await walk(await root());
        const found = fsImpl.findFileHandler(tree, "root/sub/nested.md");

        expect(found, "root/sub/nested.md should resolve").toBeDefined();
        expect(await found!.text()).toBe("deep");
      });

      check("app/findFileHandler-returns-undefined-for-an-unknown-path", async () => {
        const tree = await walk(await root());
        expect(fsImpl.findFileHandler(tree, "root/ghost/missing.md")).toBeUndefined();
      });
    });

    // Typo guard: a gap id that matches no check would silently do nothing.
    test("declared knownGaps all correspond to real checks", () => {
      expect([...gaps].filter((id) => !declared.has(id))).toEqual([]);
    });
  });
}
