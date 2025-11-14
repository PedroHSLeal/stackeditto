import { EXTENSION_STRUCTURE } from "./constants/extension-structure";
import { registerUntrustedModule } from "./registry/module";

export function useUntrustedModules() {
  async function registerUntrustedModules(userModules: { text: () => Promise<string>, webkitRelativePath: string }[]) {
    userModules.forEach(async ({ text, webkitRelativePath }) => {
      let indexOfExtensionFolder = webkitRelativePath.indexOf(EXTENSION_STRUCTURE.EXTENSION_FOLDER);
      let path = webkitRelativePath.substring(indexOfExtensionFolder + EXTENSION_STRUCTURE.EXTENSION_FOLDER.length + 1);

      registerUntrustedModule(path, await text());
    })
  }

  return {
    registerUntrustedModules,
  }
}