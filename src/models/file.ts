export type CustomFile = File & {
  directoryHandle: FileSystemDirectoryHandle;
  handle: FileSystemFileHandle;
  webkitRelativePath: string;
  extensionFile: string;

};

export type CustomDirectory = {
  directoryName: string;
  files: CustomFile[];
  directories: CustomDirectory[];
}