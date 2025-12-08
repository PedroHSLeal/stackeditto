import { CoreFileSystemDirectoryHandle, fsa, type IFileSystemHandle } from "memfs/lib/fsa";
import { useFileSystemManipulation } from "../utils";

const { dir, core } = fsa({ mode: "readwrite" });

export function useFileSystem() {
  const { getFiles } = useFileSystemManipulation();

  async function openDirectory(): Promise<CoreFileSystemDirectoryHandle> {
    return Promise.resolve(dir);
  }

  async function buildDirectoryStructure(originalHandler: IFileSystemHandle | null | undefined, json?: { [k: string]: any }) {
    core.fromJSON(json ?? {}, "/");

    if (originalHandler) {
      return await getFiles(originalHandler as unknown as FileSystemDirectoryHandle, { webkitRelativePath: originalHandler.name, handle: originalHandler as unknown as FileSystemDirectoryHandle, directories: [], files: [] })
    }
  }

  return {
    openDirectory,
    buildDirectoryStructure,
  }
}