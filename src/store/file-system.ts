
import { type CustomDirectory, type CustomFile } from "@/models/file";
import type { DiffResult } from "@/utils/diff";
import { defineStore } from "pinia";

export type StoreState = {
  originalHandler: FileSystemDirectoryHandle | null;

  directory: CustomDirectory | null;
  configDirectory: CustomDirectory | null;

  // por agora, nao acesse o $state.openedFiles, utilize os actions do store
  // openedFiles: { [key: string]: DiffResult };

  // recentlyOpenedFile: string;
}

// type FileDiff = StoreState['openedFiles'][keyof StoreState['openedFiles']];

export type Nullable<T> = { [K in keyof T]: T[K] | null };

export const useFileSystemStore = defineStore('file-system', {
  state: (): StoreState => ({
    originalHandler: null,
    directory: null,
    configDirectory: null,
    // openedFiles: {},
    // recentlyOpenedFile: ""
  }),
  actions: {
    /* openFile(filePath: string, diff: FileDiff): void {
      this.openedFiles[filePath] = diff;
    }, */
    /* getFile(filePath: string): FileDiff {
      return this.openedFiles[filePath];
    }, */
    /* hasOpenFile(filePath: string): boolean {
      return Object.keys(this.openedFiles).includes(filePath);
    } */
  }
})