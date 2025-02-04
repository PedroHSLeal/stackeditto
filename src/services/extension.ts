import type { CustomFile } from "@/models/file";
import type { Ref } from "vue";

export function useExtensions() {
  async function loadScripts(applicationDirectory: Ref<CustomFile[]>) {
    const loadImports = applicationDirectory.value.find((f) => f.name == "imports.js");

    if (loadImports) {
      window.loadImports = new Function(await loadImports.text());
      await window.loadImports();
    }

    const scriptsContent = applicationDirectory.value.filter((f) => f.name !== "imports.js").map(async (f) => [f.name.split(".")[0], await f.text()]);

    scriptsContent.forEach(async (script) => {
      script.then((s) => (window[s[0]] = new Function(s[1])));
    });
  }

  return { loadScripts };
}
