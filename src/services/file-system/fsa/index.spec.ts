import { beforeEach, describe, expect, it, vi } from "vitest";
import { nodeToFsa } from "memfs/lib/node-to-fsa";
import { fs, memfs, vol } from "memfs";
import { useFileSystem } from ".";
import { EXTENSION_STRUCTURE } from "@/services/untrusted-code-extensions";

describe("file-system service suite", async () => {
  // eu nao sei se esse tipo de teste é realmente necessário, porém estou fazendo para caso mais de estudo
  // atualizacao 05/05: nao tá fazendo muito sentido esses testes, tenho que testar outras alternativas
  describe("openDirectory()", async () => {
    it("should return the chosen directory by the user", async () => {
      vi.stubGlobal("showDirectoryPicker", vi.fn(() => {
        return nodeToFsa(fs, "/root", { mode: "readwrite" })
      }));

      const { openDirectory } = useFileSystem();

      const v = await openDirectory();

      expect(v).toBeDefined();
      expect(v?.name).toBe("root")
      expect(v?.kind).toBe("directory");
    });
    it("should catch the error for whatever reason", async () => {
      vi.stubGlobal("showDirectoryPicker", vi.fn(() => {
        throw new DOMException("DEU RUIM!", "AbortError")
      }));

      const spy = vi.spyOn(console, "error")

      const v = await useFileSystem().openDirectory();

      expect(v).toBeUndefined();
      expect(spy).toBeCalled();
    });
  });

  describe("buildDirectoryStructure()", async () => {
    it("should return a representation of the chosen directory", async () => {
      const { fs: localFs } = memfs({
        "folder-1": {
          "file-1.md": "Hello World"
        }
      });
      const expectCustomDirectory = {
        directories: [
          {
            webkitRelativePath: "/folder-1",
            files: [
              {
                webkitRelativePath: "/folder-1/file-1.md"
              }
            ]
          }
        ]
      }

      // como a tipagem do memfs é diferente do metodo do buildDirectoryStructure, estou forçando a tipagem do handler para "any"
      const handler: any = nodeToFsa(localFs, "", { mode: "readwrite" });

      const { buildDirectoryStructure } = useFileSystem();

      const customDirectory = await buildDirectoryStructure(handler);

      expect(customDirectory?.directories[0].webkitRelativePath).toBe(expectCustomDirectory.directories[0].webkitRelativePath);
      expect(customDirectory?.directories[0].files[0].webkitRelativePath).toBe(expectCustomDirectory.directories[0].files[0].webkitRelativePath);
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
  });
});