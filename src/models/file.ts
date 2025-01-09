export type CustomFile = File & {
  directoryHandle: FileSystemDirectoryHandle;
  handle: FileSystemFileHandle;
  webkitRelativePath: string;
  extensionFile: string;
};
