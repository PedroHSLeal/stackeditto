import type { CustomDirectory, CustomFile } from "@/models/file";
import { reactive, ref } from "vue";

export type DirectoryStructure = { directory: CustomFile[]; applicationDirectory: CustomFile[] };

export function useFileSystem() {
  const directoryStructure = ref<CustomDirectory>();
  const originalHandle = ref<FileSystemHandle>();
  const excludeDirectories = [".git", ".obsidian"];

  async function populateDirectory(structure: typeof directoryStructure.value) {
    return basePopulateDirectory(structure);
  }

  async function repopulateDirectory(structure: typeof directoryStructure.value) {
    return basePopulateDirectory(structure);
  }

  async function basePopulateDirectory(filesInDirectory: CustomDirectory | undefined) {
    if (!filesInDirectory) {
      return { directory: { directoryName: "", files: [], directories: [] }, applicationDirectory: { directoryName: "", files: [], directories: [] } };
    }

    const stackeditoDirectoryIndex = filesInDirectory.directories.findIndex((d) => d.directoryName == ".stackeditto");
    const appDirectory = stackeditoDirectoryIndex < 0 ? { directoryName: "", files: [], directories: [] } : filesInDirectory.directories.splice(stackeditoDirectoryIndex, 1)[0];

    return { directory: filesInDirectory, applicationDirectory: appDirectory };
  }

  async function getFiles(dirHandle: FileSystemHandle, tree: CustomDirectory, path = dirHandle.name): Promise<CustomDirectory> {
    const dirs = [];
    const files = [];

    for await (const entry of dirHandle.values()) {
      const nestedPath = `${path}/${entry.name}`;
      if (entry.kind === "file") {
        files.push(
          entry.getFile().then((file: any) => {
            return Object.defineProperties<CustomFile>(file, {
              directoryHandle: {
                configurable: true,
                enumerable: true,
                get: () => dirHandle,
              },
              handle: {
                configurable: true,
                enumerable: true,
                get: () => entry,
              },
              extensionFile: {
                configurable: true,
                enumerable: true,
                get: () => file.name.substring(file.name.lastIndexOf(".") + 1, file.name.length),
              },
              webkitRelativePath: {
                configurable: true,
                enumerable: true,
                get: () => nestedPath,
              },
            });
          })
        );
      } else if (entry.kind === "directory" && !excludeDirectories.includes(entry.name)) {
        const newTree: CustomDirectory = { directoryName: entry.name, directories: [], files: [] };
        const leaf = await getFiles(entry, newTree, nestedPath);

        newTree.directories = leaf.directories;
        newTree.files = leaf.files;

        /* if (newTree.files.length > 0) dirs.push(newTree); */
        dirs.push(newTree);
      }
    }

    tree.directories = dirs;
    tree.files = await Promise.all(files);

    return tree;
  }

  async function openDirectory(): Promise<void> {
    try {
      originalHandle.value = await showDirectoryPicker({ mode: "readwrite" });
      directoryStructure.value = await getFiles(originalHandle.value, { directoryName: originalHandle.value.name, directories: [], files: [] });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error(err.name, err.message);
      }
    }
  }

  async function reopenDirectory(): Promise<void> {
    try {
      if (originalHandle.value) directoryStructure.value = await getFiles(originalHandle.value, { directoryName: originalHandle.value.name, directories: [], files: [] });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error(err.name, err.message);
      }
    }
  }

  async function saveFile(fileHandle: FileSystemFileHandle, fileContent: string) {
    if (!fileHandle) return;

    const writable = await fileHandle.createWritable();
    await writable.write(fileContent);
    await writable.close();
  }

  return {
    originalHandle,
    directoryStructure,

    openDirectory,
    reopenDirectory,
    populateDirectory,
    repopulateDirectory,
    saveFile,
  };
}
