import { beforeEach, describe, expect, it, vi } from "vitest";
import { nodeToFsa } from "memfs/lib/node-to-fsa";
import { fs, memfs, vol } from "memfs";
import { fsa } from "memfs/lib/fsa";
import { useFileSystem } from ".";
import { EXTENSION_STRUCTURE } from "../untrusted-code-extensions";

describe("file-system service suite", async () => {
  describe("openDirectory()", async () => {
    it("should return the chosen directory by the user", async () => {
      vi.stubGlobal("showDirectoryPicker", vi.fn(() => {
        return fsa({ mode: "readwrite" })
      }));

      const { openDirectory } = useFileSystem();

      const v = await openDirectory();

      expect(v).toBeDefined();
    });
  });

  describe("buildDirectoryStructure()", async () => {
    it("should return a representation of the chosen directory", async () => {
      const expectedRootDirPath = "root";
      const expectedTestFileName = "test.md";

      const { dir: fsaDir, core } = fsa({ mode: "readwrite" });

      const directory: any = {};
      directory[`${expectedRootDirPath}/${expectedTestFileName}`] = "asdf"

      core.fromJSON(directory, "/");

      const { buildDirectoryStructure } = useFileSystem();

      const customDirectory = await buildDirectoryStructure(fsaDir as any as FileSystemDirectoryHandle);

      expect(customDirectory?.directories[0].webkitRelativePath).toBe("/root");
      expect(customDirectory?.directories[0].files[0].webkitRelativePath).toBe("/root/test.md");
    });
    it("should return undefined if the handler is undefined", async () => {
      const { buildDirectoryStructure } = useFileSystem();

      const customDirectory = await buildDirectoryStructure(undefined);

      expect(customDirectory).toBeUndefined();
    });
  });

  describe("populateDirectory()", async () => {
    it("should return a object containing the proper chosen directory and the app directory, containing config file and extensions", async () => {
      const filesInDirectory: any = {
        directories: [
          {
            webkitRelativePath: "seila",
            directories: [],
            files: []
          },
          {
            webkitRelativePath: EXTENSION_STRUCTURE.EXTENSION_FOLDER,
            directories: [],
            files: []
          },
        ]
      }

      const { populateDirectory } = useFileSystem();

      const customDirectory = populateDirectory(filesInDirectory);

      expect(customDirectory?.directory?.directories).toHaveLength(1);
      expect(customDirectory?.applicationDirectory).toBeDefined();
    });
    it("should return an undefined when 'filesInDirectory' parameter is null or undefined", async () => {
      const { populateDirectory } = useFileSystem();

      const nullCustomDirectory = populateDirectory(null);
      const undefinedCustomDirectory = populateDirectory(undefined);

      expect(nullCustomDirectory).toBeUndefined();
      expect(undefinedCustomDirectory).toBeUndefined();
    });
  });

  describe("saveFile()", async () => {
    it("should save content in an existing file in file system handle", async () => {
      const expectedFileContent = "alguma coisa qualquer";

      const { dir, core } = fsa({ mode: "readwrite", syncHandleAllowed: true });
      core.fromJSON({ 'test.md': "" }, "/")

      const { buildDirectoryStructure, saveFile } = useFileSystem();

      const directoryStructure = await buildDirectoryStructure(dir);

      const customFile = directoryStructure!.files[0];

      const fileHandle = await customFile.handle.getFile();
      await saveFile(customFile.handle, expectedFileContent);

      const reader = new FileReader()
      reader.readAsText(fileHandle)

      reader.onloadend = () => {
        expect(expectedFileContent).toBe(reader.result);
      }
    })
  });

  describe("createNewFile()", async () => {
    it("should create a new file using directoryHandle with a file name and content", async () => {
      const expectedFileName = "test.md";
      const { dir: rootDir } = fsa({ mode: "readwrite" });

      const { createNewFile } = useFileSystem();

      const fileHandle = await createNewFile(rootDir as any as FileSystemDirectoryHandle, expectedFileName, "");

      expect(fileHandle?.name).toBe("test.md")
    })
    it.for([["empty", ""], ["null", null], ["undefined", undefined]])
      ("should not create a new file when fileName is %s", async ([_, fileContentToSave]) => {
        const { dir: rootDir } = fsa({ mode: "readwrite" });

        const { createNewFile } = useFileSystem();

        const fileHandle = await createNewFile(rootDir as any as FileSystemDirectoryHandle, fileContentToSave, "");

        expect(fileHandle).toBeUndefined();
      })
  });

  describe("createNewDirectory()", async () => {
    it("should create a new directory from the 'parentDirectoryHandle'", async () => {
      const { createNewDirectory } = useFileSystem();

      const { dir, core } = fsa({ mode: "readwrite" });
      core.fromJSON({}, "/");

      const newDirectoryHandle = await createNewDirectory(dir as any as FileSystemDirectoryHandle, "seila");

      expect(newDirectoryHandle).not.toBeUndefined();
    });
    it.for([["empty", ""], ["null", null], ["undefined", undefined]])
      ("should not create a new directory when the 'directoryName' is %s", async ([_, expectedDirectoryName]) => {
        const { createNewDirectory } = useFileSystem();

        const { dir, core } = fsa({ mode: "readwrite" });
        core.fromJSON({}, "/");

        const newDirectoryHandle = await createNewDirectory(dir as any as FileSystemDirectoryHandle, expectedDirectoryName);

        expect(newDirectoryHandle).toBeUndefined();
      })
  });

  describe("findDirectoryHandler()", async () => {
    const buildDirectoryPath = (count: number): [string[], string] => {
      let path = [];

      for (let i = 0; i <= count; i++) {
        path.push(`folder-${i}`);
      }

      return [path, path.join("/")];
    }

    it("should find the directory handler with its name in the customDirectory structure", async () => {
      const { buildDirectoryStructure, findDirectoryHandler } = useFileSystem();

      const { dir, core } = fsa({ mode: "readwrite" });

      const testDirectoryJSON: any = {};
      const [pathArray, pathString] = buildDirectoryPath(1);

      testDirectoryJSON[pathString] = {};
      core.fromJSON(testDirectoryJSON, '/');
      const startingPoint = await dir.getDirectoryHandle("folder-0");

      const directoryStructure = await buildDirectoryStructure(startingPoint as any);

      const foundCustomDirectory = findDirectoryHandler(directoryStructure!, pathString);

      expect(foundCustomDirectory).not.toBeUndefined();
      expect(foundCustomDirectory?.webkitRelativePath).toBe(pathString);
      expect(foundCustomDirectory?.handle.name).toBe((await startingPoint.getDirectoryHandle("folder-1")).name);
    });
    it("should return undefined if the 'directoryPath' does not match the start of 'entryDirectory' name", async () => {
      const { buildDirectoryStructure, findDirectoryHandler } = useFileSystem();

      const { dir, core } = fsa({ mode: "readwrite" });

      const testDirectoryJSON: any = {};
      const [pathArray, pathString] = buildDirectoryPath(1);

      testDirectoryJSON[pathString] = {};
      core.fromJSON(testDirectoryJSON, '/');
      const startingPoint = await dir.getDirectoryHandle("folder-0");

      const directoryStructure = await buildDirectoryStructure(startingPoint as any);

      const found = findDirectoryHandler(directoryStructure!, "folder-1/folder-2");

      expect(found).toBeUndefined();
    })
    it("should return undefined if the 'directoryPath' is empty", async () => {
      const { buildDirectoryStructure, findDirectoryHandler } = useFileSystem();

      const { dir, core } = fsa({ mode: "readwrite" });

      const testDirectoryJSON: any = {};
      const [pathArray, pathString] = buildDirectoryPath(1);

      testDirectoryJSON[pathString] = {};
      core.fromJSON(testDirectoryJSON, '/');
      const startingPoint = await dir.getDirectoryHandle("folder-0");

      const directoryStructure = await buildDirectoryStructure(startingPoint as any);

      const found = findDirectoryHandler(directoryStructure!, "");

      expect(found).toBeUndefined();
    })
  });

  describe("getAllFilesFromDirectory()", async () => {
    it("should traverse deep and get all files from the provided customDirectory", async () => {
      const { buildDirectoryStructure, getAllFilesFromDirectory } = useFileSystem();

      const { dir, core } = fsa({ mode: "readwrite" });
      core.fromJSON({
        "1.md": "",
        "f0/2.md": "",
        "f0/3.md": "",
        "f0/f1/f2/f3/f4/f5/4.md": ""
      }, "/");

      const customDirectory = await buildDirectoryStructure(dir as any);

      const allFiles = getAllFilesFromDirectory(customDirectory!);

      expect(allFiles).toHaveLength(4);
      expect(allFiles.map(f => f.name)).toEqual(["1.md", "2.md", "3.md", "4.md"])
    });
    it("should return empty array when provided customDirectory is empty", async () => {
      const { buildDirectoryStructure, getAllFilesFromDirectory } = useFileSystem();

      const { dir, core } = fsa({ mode: "readwrite" });
      core.fromJSON({}, "/");

      const emptyCustomDirectory = await buildDirectoryStructure(dir as any);

      const allFiles = getAllFilesFromDirectory(emptyCustomDirectory!);

      expect(allFiles).toHaveLength(0);
    });
  })
});