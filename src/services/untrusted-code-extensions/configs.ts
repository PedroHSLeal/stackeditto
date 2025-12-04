import type { CustomDirectory } from "@/models/file-system";
import { EXTENSION_STRUCTURE } from "./constants/extension-structure";

export function useExtensionConfigs() {
  function loadConfigsJson(applicationDirectory: CustomDirectory) {
    return applicationDirectory.files.find(f => f.name == EXTENSION_STRUCTURE.CONFIGS__JSON);
  }

  return {
    loadConfigsJson
  }
}