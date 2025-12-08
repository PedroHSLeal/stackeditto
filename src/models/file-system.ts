import type { CoreFileSystemDirectoryHandle, CoreFileSystemHandle } from "~/memfs/lib/fsa";

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

export const EXCLUDED_DIRECTORIES = [".git", ".obsidian"];

// type UnionTypes<TypeA, TypeB> = Omit<TypeA & TypeB, Exclude<keyof TypeB, keyof TypeA> | Exclude<keyof TypeA, keyof TypeB>>

// export type DirectoryHandle = UnionTypes<FileSystemDirectoryHandle, CoreFileSystemDirectoryHandle>;

// export type _DirectoryHandle = UnionTypes<FileSystemDirectoryHandle, CoreFileSystemDirectoryHandle>;

// export type _FileSystemHandle = UnionTypes<FileSystemHandle, CoreFileSystemHandle>;