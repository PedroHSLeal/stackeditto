import { type CustomDirectory } from "@/models/file-system";
import { useFileSystemManipulation } from "../utils";

export function useFileSystem() {
  const { getFiles } = useFileSystemManipulation();

  async function openDirectory(): Promise<FileSystemDirectoryHandle | undefined> {
    try {
      return await showDirectoryPicker({ mode: "readwrite" });
    } catch (err: any) {
      console.error(`${err.name}: ${err.message}`);
    }
  }

  async function buildDirectoryStructure(originalHandler: FileSystemDirectoryHandle | null | undefined): Promise<CustomDirectory | undefined> {
    if (originalHandler) {
      return await getFiles(originalHandler, { webkitRelativePath: originalHandler.name, handle: originalHandler, directories: [], files: [] });
    }
  }

  return {
    openDirectory,
    buildDirectoryStructure,
  };
}
