import { EXCLUDED_DIRECTORIES, type CustomDirectory, type CustomFile } from "@/models/file-system";
import { EXTENSION_STRUCTURE } from "../untrusted-code-extensions";

export function useFileSystemManipulation() {
  async function getFiles(dirHandle: FileSystemDirectoryHandle, tree: CustomDirectory, path = dirHandle.name): Promise<CustomDirectory> {
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
      } else if (entry.kind === "directory" && !EXCLUDED_DIRECTORIES.includes(entry.name)) {
        const newTree: CustomDirectory = { webkitRelativePath: nestedPath, handle: entry, directories: [], files: [] };
        const leaf = await getFiles(entry, newTree, nestedPath);

        newTree.directories = leaf.directories;
        newTree.files = leaf.files;

        dirs.push(newTree);
      }
    }

    tree.directories = dirs;
    tree.files = await Promise.all(files);

    tree.files.sort((a, b) => a.handle.name.localeCompare(b.handle.name));
    tree.directories.sort((a, b) => a.handle!.name.localeCompare(b.handle!.name));

    return tree;
  }

  function populateDirectory(filesInDirectory: CustomDirectory | null | undefined): { directory: CustomDirectory | null, applicationDirectory: CustomDirectory | null } | undefined {
    if (!filesInDirectory) {
      return undefined;
    }

    const stackeditoDirectoryIndex = filesInDirectory.directories.findIndex((d) => d.webkitRelativePath.endsWith(EXTENSION_STRUCTURE.EXTENSION_FOLDER));
    const appDirectory = stackeditoDirectoryIndex < 0 ? null : filesInDirectory.directories.splice(stackeditoDirectoryIndex, 1)[0];

    return { directory: filesInDirectory, applicationDirectory: appDirectory };
  }


  async function createNewFile(directoryHandle: FileSystemDirectoryHandle, fileName: string, fileContent: string) {
    const handle = await directoryHandle.getFileHandle(fileName, { create: true });
    if (!handle) return;

    await saveFile(handle, fileContent);
  }

  async function createNewDirectory(directoryHandle: FileSystemDirectoryHandle, directoryName: string): Promise<FileSystemDirectoryHandle> {
    return await directoryHandle.getDirectoryHandle(directoryName, { create: true });
  }

  async function saveFile(fileHandle: FileSystemFileHandle, fileContent: string) {
    if (!fileHandle) return;

    const writable = await fileHandle.createWritable();
    await writable.write(fileContent);
    await writable.close();
  }

  async function deleteFile(parentDirectory: FileSystemDirectoryHandle, fileName: string) {
    await parentDirectory.removeEntry(fileName);
  }

  async function deleteDirectory(parentDirectory: FileSystemDirectoryHandle, directoryToDelete: FileSystemDirectoryHandle, recursive = false) {
    try {
      await parentDirectory.removeEntry(directoryToDelete.name, { recursive });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.code == DOMException.INVALID_MODIFICATION_ERR)
        return false;
    }
  }

  async function renameFile(parentDirectory: FileSystemDirectoryHandle, oldFileName: string, newFileName: string, fileContent: string) {
    await createNewFile(parentDirectory, newFileName, fileContent);
    await deleteFile(parentDirectory, oldFileName);
  }

  async function renameDirectory(parentDirectory: FileSystemDirectoryHandle, directoryToRename: FileSystemDirectoryHandle, newDirectoryName: string) {
    const newDirectory = await createNewDirectory(parentDirectory, newDirectoryName);

    for await (const resource of directoryToRename.values()) {
      if (resource.kind == "file") {
        await createNewFile(newDirectory, resource.name, await (await resource.getFile()).text());
      }
      else if (resource.kind == "directory") {
        await renameDirectory(newDirectory, resource, resource.name);
      }
    }
  }

  function findFileHandler(entryDirectory: CustomDirectory, filePath: string): CustomFile | undefined {
    let sliceFilePath = filePath.split("/").slice(1);

    if (sliceFilePath.length == 1) {
      return entryDirectory.files.find(d => d.handle.name == sliceFilePath[0]);
    }
    else if (sliceFilePath.length > 1) {
      let parent = entryDirectory.directories.find(d => d.handle.name == sliceFilePath[0]);
      return findFileHandler(parent!, sliceFilePath.join("/"));
    }
  }

  function findDirectoryHandler(entryDirectory: CustomDirectory, directoryPath: string): CustomDirectory | undefined {
    let sliceDirectoryPath = directoryPath.split("/").slice(1);

    if (sliceDirectoryPath.length == 1) {
      return entryDirectory.directories.find(d => d.handle.name == sliceDirectoryPath[0]);
    }
    else if (sliceDirectoryPath.length > 1) {
      let parent = entryDirectory.directories.find(d => d.handle.name == sliceDirectoryPath[0]);
      return findDirectoryHandler(parent!, sliceDirectoryPath.join("/"));
    }
  }

  // UTILS
  function getAllFilesFromDirectory(directory: CustomDirectory): CustomFile[] {
    let files: CustomFile[] = [];

    if (directory.files) {
      files.push(...directory.files);
    }

    if (directory.directories) {
      for (const dir of directory.directories) {
        files.push(...getAllFilesFromDirectory(dir));
      }
    }

    return files;
  }

  async function calcuteCountOfFilesAndDirectories(directory: CustomDirectory) {
    let countFiles = 0;
    let countDirectories = 0;

    countFiles += directory.files.length;
    countDirectories += directory.directories.length;

    for (const dir of directory.directories) {
      let result = await calcuteCountOfFilesAndDirectories(dir);

      countFiles += result.countFiles;
      countDirectories += result.countDirectories;
    }

    return { countFiles, countDirectories };
  }

  return {
    getFiles,
    populateDirectory,

    createNewFile,
    createNewDirectory,

    saveFile,
    deleteFile,

    deleteDirectory,

    renameFile,
    renameDirectory,

    findFileHandler,
    findDirectoryHandler,

    getAllFilesFromDirectory,
    calcuteCountOfFilesAndDirectories
  }
}