import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Structure } from "../in-memory/json-structure";
import { useFileSystem as useInMemoryFileSystem } from "../in-memory";
import { useFileSystem } from "../fsa";
import { useFileSystemManipulation } from ".";

const { openDirectory } = useInMemoryFileSystem();

describe("file-system manipulation", async () => {
  let jsonStructure: Structure;

  beforeEach(async () => {
    vi.unstubAllGlobals();

    vi.stubGlobal("showDirectoryPicker", async () => {
      return await openDirectory(jsonStructure);
    });
  });

  describe("getFiles()", async () => {
    const { getFiles } = useFileSystemManipulation();

    test("should convert the file-system directory and turn into a CustomDirectory structure", async () => {
      jsonStructure = {
        kind: "directory",
        name: "folder-1",
        children: [
          {
            kind: "file",
            name: "file-1.md",
            content: "# hello world"
          }
        ]
      };

      const { openDirectory } = useFileSystem();
      const directoryHandle = await openDirectory();
      const customDirectory = await getFiles(directoryHandle!, { handle: directoryHandle!, webkitRelativePath: directoryHandle!.name, directories: [], files: [] });

      expect(customDirectory).toBeDefined();
    });
    /* test.each([null, undefined])("should return undefined when the provided directoryHandle is %p", async (providedValue) => {
      const customDirectory = await getFiles(providedValue!, { handle: directoryHandle!, webkitRelativePath: directoryHandle!.name, directories: [], files: [] });

      expect(customDirectory).toBeDefined();
    }); */
  })
})