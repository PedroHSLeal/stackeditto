import { registerUntrustedHtmlBlock } from "./registry/html-blocks";
import { getModule } from "./registry/module";

export function useUntrustedScripts() {
  async function loadUntrustedScript(scriptContent: string, ...args: any): Promise<any> {
    return new Function(scriptContent)()(...args);
  }

  async function executeUntrustedScript(userScripts: Promise<string>[]) {
   Promise.all(userScripts)
    .then(files => Promise.all(files.map(f => {
      return loadUntrustedScript(
        `return async function(registerHtmlBlock, getModule) { \n ${f} \n }`,
        registerUntrustedHtmlBlock,
        getModule
      );
    })))
    .catch(error => console.error(error));
  }

  return {
    loadUntrustedScript,
    executeUntrustedScript
  };
}