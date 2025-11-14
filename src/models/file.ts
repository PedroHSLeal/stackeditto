export type CustomFile = File & {
  directoryHandle: FileSystemDirectoryHandle;
  handle: FileSystemFileHandle;
  webkitRelativePath: string;
  extensionFile: string;
};

export type CustomDirectory = {
  webkitRelativePath: string;
  handle: FileSystemDirectoryHandle;
  files: CustomFile[];
  directories: CustomDirectory[];
};

export enum ModalOperation {
  FILE,
  DIRECTORY
};