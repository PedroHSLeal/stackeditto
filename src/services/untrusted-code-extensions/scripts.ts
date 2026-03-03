import { registerUntrustedHtmlBlock } from "./registry/html-blocks";
import { getModule } from "./registry/module";

export function useUntrustedScripts() {
  async function loadUntrustedScript(scriptContent: string, ...args: any): Promise<any> {
    return new Function(scriptContent)()(...args);
  }

  async function executeUntrustedScript(userScripts: Promise<string>[]) {
    const scripts = await Promise.all(userScripts);
    for (const script of scripts) {
      let t = script.split("\n").filter(f => !f.startsWith("//")).join("\n");

      loadUntrustedScript(
        `return async function(registerHtmlBlock, getModule) { \n ${t} \n }`,
        registerUntrustedHtmlBlock,
        getModule
      );
    }

  }

  return {
    loadUntrustedScript,
    executeUntrustedScript
  };
}