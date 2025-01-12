import type { CustomFile } from "@/models/file";

export function useFileSystem() {
  let directoryStructure: Promise<CustomFile[] | undefined>;
  let originalHandle: FileSystemHandle;

  async function populateDirectory() {
    const filesInDirectory = await openDirectory();
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

  async function repopulateDirectory() {
    const filesInDirectory = await getFiles(originalHandle);
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

  async function getFiles(dirHandle: FileSystemHandle, path = dirHandle.name): Promise<CustomFile[] | undefined> {
    const dirs = [];
    const files = [];

    for await (const entry of dirHandle.values() as Iterable<FileSystemHandle>) {
      const nestedPath = `${path}/${entry.name}`;
      if (entry.kind === "file") {
        files.push(
          (entry as FileSystemFileHandle).getFile().then((file) => {
            file.directoryHandle = dirHandle;
            file.handle = entry;
            file.extensionFile = file.name.substring(file.name.lastIndexOf(".") + 1, file.name.length);

            return Object.defineProperty(file, "webkitRelativePath", {
              configurable: true,
              enumerable: true,
              get: () => nestedPath,
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

  async function verifyPermission(fileHandle: FileSystemFileHandle, readWrite: boolean) {
    const options = { mode: "read" };

    if (readWrite) {
      options.mode = "readwrite";
    }
    // Check if permission was already granted. If so, return true.
    if ((await fileHandle.queryPermission(options)) === "granted") {
      return true;
    }
    // Request permission. If the user grants permission, return true.
    if ((await fileHandle.requestPermission(options)) === "granted") {
      return true;
    }
    // The user didn't grant permission, so return false.
    return false;
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
    verifyPermission,
    saveFile,
  };
}
