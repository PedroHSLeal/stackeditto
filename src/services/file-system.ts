import type { CustomFile } from "@/models/file";

export type DirectoryStructure = { directory: CustomFile[], applicationDirectory: CustomFile[] }

export function useFileSystem() {
  let directoryStructure: Promise<CustomFile[] | undefined>;
  let originalHandle: FileSystemHandle;

  async function populateDirectory() {
    return basePopulateDirectory(await openDirectory())
  }

  async function repopulateDirectory() {
    return basePopulateDirectory(await getFiles(originalHandle));
  }

  async function basePopulateDirectory(filesInDirectory: CustomFile[] | undefined) {
    const directory = [];
    const applicationDirectory = [];

    if (!filesInDirectory) {
      return;
    }

    directory.push(
      ...filesInDirectory.filter((f) => {
        return !f.webkitRelativePath.includes("/.");
      })
    );

    applicationDirectory.push(...filesInDirectory.filter((f) => f.webkitRelativePath.includes("/.stackeditto")));

    return { directory, applicationDirectory };
  }

  async function getFiles(dirHandle: FileSystemHandle, path = dirHandle.name): Promise<CustomFile[]> {
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
                get: () => entry
              },
              extensionFile: {
                configurable: true,
                enumerable: true,
                get: () => file.name.substring(file.name.lastIndexOf(".") + 1, file.name.length)
              },
              webkitRelativePath: {
                configurable: true,
                enumerable: true,
                get: () => nestedPath,
              },
            });
          })
        );
      } else if (entry.kind === "directory") {
        dirs.push(getFiles(entry, nestedPath));
      }
    }
    return [...(await Promise.all(dirs)).flat(), ...(await Promise.all(files))];
  }

  async function openDirectory(): typeof directoryStructure {
    try {
      // @ts-ignore
      originalHandle = await showDirectoryPicker({ mode: "readwrite" });

      directoryStructure = getFiles(originalHandle);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error(err.name, err.message);
      }
    }

    return directoryStructure;
  }

  async function saveFile(fileHandle: FileSystemFileHandle, fileContent: string) {
    if (!fileHandle) return;

    const writable = await fileHandle.createWritable();
    await writable.write(fileContent);
    await writable.close();
  }

  return {
    populateDirectory,
    repopulateDirectory,
    saveFile,
  };
}
