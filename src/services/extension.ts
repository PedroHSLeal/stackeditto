import type { CustomDirectory } from "@/models/file";

export function useExtensions() {
  async function loadScripts(applicationDirectory: CustomDirectory) {
    const loadImports = applicationDirectory.files.find((f) => f.name == "imports.js");

    if (loadImports) {
      window.loadImports = new Function(await loadImports.text());
      await window.loadImports();
    }

    const scriptsContent = applicationDirectory.files.filter((f) => f.name !== "imports.js").map(async (f) => [f.name.split(".")[0], await f.text()]);

    scriptsContent.forEach(async (script) => {
      script.then((s) => (window[s[0]] = new Function(s[1])));
    });
  }

  return { loadScripts };
}
