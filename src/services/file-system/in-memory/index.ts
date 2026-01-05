import { useFileSystemManipulation } from "../utils";
import { traverseStructure, type Structure } from "./json-structure";

export function useFileSystem() {
  const { getFiles } = useFileSystemManipulation();

  async function openDirectory(json: Structure | null | undefined): Promise<FileSystemDirectoryHandle | undefined> {
    if (!json) return Promise.resolve(undefined);
    if (typeof json == "object" && Object.keys(json).length == 0) return Promise.resolve(undefined);

    return Promise.resolve(createDirectoryHandle({ name: json.name, children: traverseStructure(json, createDirectoryHandle, createFileHandle) }));
  }

  async function buildDirectoryStructure(originalHandler: FileSystemDirectoryHandle | null | undefined) {
    if (originalHandler) {
      return await getFiles(originalHandler, { webkitRelativePath: originalHandler.name, handle: originalHandler, directories: [], files: [] })
    }
  }

  function createDirectoryHandle(args: { name: string, children: { [key: string]: any } }) {
    return {
      kind: "directory",
      name: args.name,
      isFile: false,
      isDirectory: true,
      isSameEntry: async function (other: FileSystemHandle): Promise<boolean> {
        return false;
      },
      resolve: async function (possibleDescendant: FileSystemHandle) {
        return [""];
      },
      keys: async function* (): AsyncIterableIterator<string> {
        for (const key of Object.keys(args.children)) {
          yield key;
        }
      },
      values: async function* (): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle> {
        for (const value of Object.values(args.children)) {
          yield value;
        }
      },
      entries: async function* (): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]> {
        for (const entry of Object.entries(args.children)) {
          yield entry;
        }
      },
      getDirectoryHandle: async function (name: string, options?: FileSystemGetDirectoryOptions): Promise<FileSystemDirectoryHandle> {
        if (options?.create)
          return createDirectoryHandle({ name, children: {} })
        else {
          const found = args.children[name];

          if (!found) throw new DOMException("", "NotFoundError");
          else if (found.kind == "file") throw new DOMException("", "TypeMismatchError");
          else return found;
        }
      },
      getFileHandle: async function (name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle> {
        const file = args.children[name];

        if (!file && !!options?.create) throw new DOMException("", "NotFoundError");
        if (file.kind == "directory") throw new DOMException("", "TypeMismatchError");
        if (options?.create) return createFileHandle({ name, content: [""] })

        return file;

      },
    } as FileSystemDirectoryHandle;
  }

  function createFileHandle(args: { name: string, content: BlobPart[] }) {
    return {
      kind: "file",
      name: args.name,
      isFile: true,
      isDirectory: false,
      getFile: async function (): Promise<File> {
        return new File(args.content, args.name)
      },
      createWritable: async function (options: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream> {
        return {
          write: async function (data: FileSystemWriteChunkType) {
            args.content = [data.toString()];
          },
          close: async function () { }
        } as FileSystemWritableFileStream;
      },
    } as FileSystemFileHandle;
  }

  return {
    openDirectory,
    buildDirectoryStructure,
  }
}