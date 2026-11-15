import { EXTENSION_STRUCTURE } from "./constants/extension-structure";

export function useUntrustedModules() {
  const modulesMap = new Map<string, string>();

  function registerUntrustedModules(userModules: { text: string, webkitRelativePath: string }[]) {
    for (const { text, webkitRelativePath } of userModules) {
      let indexOfExtensionFolder = webkitRelativePath.indexOf(EXTENSION_STRUCTURE.EXTENSION_FOLDER);
      let path = webkitRelativePath.substring(indexOfExtensionFolder + EXTENSION_STRUCTURE.EXTENSION_FOLDER.length + 1);

      registerUntrustedModule(path, text);
    }
  }

  function registerUntrustedModule(scriptContent: string, scriptPath: string, type = 'application/javascript') {
    const blob = new Blob([scriptContent], { type });
    const moduleUrl = URL.createObjectURL(blob);

    modulesMap.set(scriptPath, moduleUrl);
  }

  function getModule(scriptPath: string): string | null {
    return modulesMap.has(scriptPath) ? modulesMap.get(scriptPath)! : null;
  }

  return {
    registerUntrustedModules,
    registerUntrustedModule,
    getModule
  }
}