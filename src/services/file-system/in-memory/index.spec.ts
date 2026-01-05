import { describe, expect, test } from "vitest";
import { useFileSystem } from ".";
import type { Structure } from "./json-structure";

describe("(in-memory) file-system service suite", async () => {
  describe("openDirectory()", async () => {
    const { openDirectory } = useFileSystem();

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

      const handler = await openDirectory(structure);
      const file = await handler!.getFileHandle(structure.children[0].name);
      const fileContent = await (await file.getFile()).text();

      const expectDirectoryHandle = {
        name: "folder-1",
        kind: "directory"
      };

      expect(handler!.name).toBe(expectDirectoryHandle.name);
      expect(handler!.kind).toBe(expectDirectoryHandle.kind);

      const expectFileHandle = {
        name: "file-1.md",
        kind: "file",
        content: ""
      }

      expect(file.name).toBe(expectFileHandle.name);
      expect(file.kind).toBe(expectFileHandle.kind);
      expect(fileContent).toBe(expectFileHandle.content);
    });

    test.each([null, undefined, {}])("should return empty when the provided structure is nullable (%s)", async (structure) => {
      const handler = await openDirectory(structure as any);

      expect(handler).toBeUndefined();
    });
  });

  describe("buildDirectoryStructure()", async () => {
    const { openDirectory, buildDirectoryStructure } = useFileSystem();

    test("should return a custom directory structure", async () => {
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

      const customDirectory = await buildDirectoryStructure(await openDirectory(structure));

      const expectedCustomDirectory = {
        webkitRelativePath: "folder-1",
        directories: [],
        files: [
          { webkitRelativePath: "folder-1/file-1.md" }
        ],
      };

      expect(customDirectory!.handle).not.toBeUndefined();
      expect(customDirectory!.directories).toHaveLength(0);
      expect(customDirectory!.files[0].webkitRelativePath).toBe(expectedCustomDirectory.files[0].webkitRelativePath);
    });

    test.each([null, undefined])("should return empty when the provided handler is nullable (%s)", async (structure) => {
      const customDirectory = await buildDirectoryStructure(structure as any);

      expect(customDirectory).toBeUndefined();
    });
  });
});