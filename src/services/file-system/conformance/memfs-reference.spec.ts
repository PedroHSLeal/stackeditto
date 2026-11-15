import { memfs } from "memfs";
import { nodeToFsa } from "memfs/lib/node-to-fsa";

import type { Structure } from "../in-memory/json-structure";
import { runFsaConformance } from "./fsa-conformance";

/**
 * REFERENCE SUBJECT — not shipped in the app.
 *
 * memfs/node-to-fsa is a maintained, spec-shaped FSA implementation. Running the
 * same matrix against it is what proves the matrix encodes real File System
 * Access behaviour instead of whatever our own fake happens to do: a check that
 * fails here is probably a bug in the check, not in the backend.
 *
 * It is also the candidate backend for tests if the in-memory fake is retired —
 * see docs/in-memory-fs-diagnosis.md §4.1. Delete this file if that option is
 * ruled out; nothing in src/ imports it.
 */

function seedVolume(structure: Structure) {
  const { fs } = memfs();
  const rootPath = `/${structure.name}`;

  fs.mkdirSync(rootPath, { recursive: true });

  (function write(node: Structure, path: string) {
    for (const child of node.children) {
      const childPath = `${path}/${child.name}`;

      if (child.kind == "directory") {
        fs.mkdirSync(childPath, { recursive: true });
        write(child, childPath);
      } else {
        fs.writeFileSync(childPath, child.content);
      }
    }
  })(structure, rootPath);

  return { fs, rootPath };
}

runFsaConformance({
  name: "memfs/node-to-fsa (reference)",
  createRoot: async (structure) => {
    const { fs, rootPath } = seedVolume(structure);

    // memfs handles implement the same shape but are not the DOM classes.
    return nodeToFsa(fs as any, rootPath, { mode: "readwrite" }) as unknown as FileSystemDirectoryHandle;
  },
  knownGaps: [
    // A genuine memfs gap: the handle itself is not async-iterable, only its
    // keys()/values()/entries() are. The app only uses values(), so this is
    // latent rather than blocking.
    "read/async-iterable-directory-handle",

    // NOT memfs gaps — these fail here precisely BECAUSE the backend is
    // correct, which is what makes them worth keeping: the bugs are in
    // useFileSystemManipulation.
    //   renameDirectory copies without removing the source (code-review §1.6)
    //   findFileHandler throws on an unknown path (code-review §1.11)
    "app/renameDirectory-moves-children-and-drops-the-old-name",
    "app/findFileHandler-returns-undefined-for-an-unknown-path",
  ],
});
