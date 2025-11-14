import { shallowRef } from "vue";
import type { Value } from "../markdown/remark";

type OpenedFileValue = { handler: FileSystemFileHandle, value: Value };

const openedFilesMap = shallowRef<Map<string, OpenedFileValue>>(new Map());
const openedFilesValues = shallowRef<string[]>([]);

let lastOpenedFile: OpenedFileValue | undefined = undefined;

export function useOpenFiles() {
  function getOpenedFiles() { return openedFilesValues; }
  function updateOpenedFiles() { openedFilesValues.value = [...openedFilesMap.value.keys()]; }

  function hasFile(keyPath: string) { return openedFilesMap.value.has(keyPath); }

  function getFile(keyPath: string) { return openedFilesMap.value.get(keyPath); }

  function setFile(keyPath: string, handler: FileSystemFileHandle, value: Value) {
    openedFilesMap.value.set(keyPath, { handler, value });
    updateOpenedFiles();
  }

  function updateFile(keyPath: string, value: Value) {
    if (hasFile(keyPath)) {
      let { handler } = getFile(keyPath)!;
      setFile(keyPath, handler, value);
    }
  }

  function deleteFile(keyPath: string) {
    openedFilesMap.value.delete(keyPath);
    updateOpenedFiles();
  }

  function getLastOpenedFile() { return lastOpenedFile; }
  function setLastOpenedFile(handler: FileSystemFileHandle, value: Value) { lastOpenedFile = { handler, value }; }

  return {
    openedFilesMap,
    openedFilesValues,

    getOpenedFiles,
    updateOpenedFiles,

    hasFile,
    getFile,
    setFile,
    updateFile,
    deleteFile,

    getLastOpenedFile,
    setLastOpenedFile,
  }
}