import { describe, expect, it } from "vitest";
import { useFileSystem } from "../fsa";
import { useFileSystem as useInMemoryFileSystem } from ".";
import type { Structure } from "./json-structure";

describe("file-system service suite", async () => {
  describe("buildDirectoryStructure()", async () => {
    it("should return a representation of the chosen directory", async () => {
      const structure: Structure = {
        name: "folder-1",
        kind: "directory",
        children: [
          {
            kind: "file",
            name: "file-1.md",
            content: ""
          }
        ]
      };

      const handler = await useInMemoryFileSystem().openDirectory(structure);

      const expectCustomDirectory = {
        webkitRelativePath: "folder-1",
        files: [
          {
            webkitRelativePath: "folder-1/file-1.md"
          }
        ]
      };

      const { buildDirectoryStructure } = useFileSystem();

      const customDirectory = await buildDirectoryStructure(handler);

      expect(customDirectory?.webkitRelativePath).toBe(expectCustomDirectory.webkitRelativePath);
      expect(customDirectory?.files[0].webkitRelativePath).toBe(expectCustomDirectory.files[0].webkitRelativePath);
    });
    it("should return undefined if the handler is undefined", async () => {
      const { buildDirectoryStructure } = useFileSystem();

      const customDirectory = await buildDirectoryStructure(undefined);

      expect(customDirectory).toBeUndefined();
    });
  });
});