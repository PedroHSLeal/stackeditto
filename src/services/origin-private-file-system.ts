import type { CustomFile } from "@/models/file";
import OriginPrivateFileSystem from "@/workers/opfs?worker";
import type { Ref } from "vue";

export function useOriginPrivateFileSystem(directory: Ref<CustomFile[]>) {
  const worker = new OriginPrivateFileSystem();

  function seila() {
    worker.postMessage({ data: "alguma coisa" })
  }

  return {
    seila
  }
}
