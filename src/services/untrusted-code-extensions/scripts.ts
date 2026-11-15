import { useUntrustedModules } from "./modules";
import { registerUntrustedHtmlBlock } from "./registry/html-blocks";

export function useUntrustedScripts() {
  const { getModule } = useUntrustedModules();

  async function loadUntrustedScript(scriptContent: string, ...args: any): Promise<any> {
    return new Function(scriptContent)()(...args);
  }

  async function executeUntrustedScript(userScripts: Promise<string>[]) {
    const scripts = await Promise.all(userScripts);
    for (const script of scripts) {
      let s = script
        .replace(/(?:\/\*)(?:\w|\W|[^*/]{1})*?(?:\*\/)/g, "") // retirar comentários multi-line (/**/)
        .replace(/^(?:\s|\t)*\/\/.*$/gm, ""); // retirar comentários inline (//)

      loadUntrustedScript(
        `return async function(registerHtmlBlock, getModule) { \n ${s} \n }`,
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