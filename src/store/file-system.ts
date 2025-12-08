
import { type CustomDirectory } from "@/models/file-system";
import { defineStore } from "pinia";

export type StoreState = {
  originalHandler: unknown;

  directory: CustomDirectory | null;
  configDirectory: CustomDirectory | null;
}

export const useFileSystemStore = defineStore('file-system', {
  state: (): StoreState => ({
    originalHandler: null,

    directory: null,
    configDirectory: null,
  }),
  actions: {}
})