<template>
  <div id="editor" class="container">
    <div id="topbar" style="background-color: lightblue; height: 24px; display: flex; align-items: center; padding-left: 8px">
      <p>{{ path }}</p>
      <button @click="saveFile" style="border: 0">Salvar</button>
    </div>
    <div ref="refEditor" style="flex: 1 1 0%" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUpdated, ref } from "vue";
import * as monacoEditor from "monaco-editor"
import type { CustomFile } from "@/models/file";

let editor: monacoEditor.editor.IStandaloneCodeEditor;

const fileFormatMap = new Map<string, string>([
  ["md", "markdown"],
  ["js", "javascript"],
  ["ts", "typescript"],
  ["html", "html"],
  ["css", "css"],
  ["json", "json"],
]);

const props = defineProps<{ path: string, fileContent: string, language: string }>();
const emits = defineEmits<{ (e: "save", fileTempContent: string): void, (e: "change", fileTempContent: string): void }>();

const refEditor = ref<HTMLElement>();

onMounted(async () => {
  if (refEditor.value && props.fileContent && props.language)
    editor = monacoEditor.editor.create(refEditor.value, {
      value: await props.fileContent,
      language: fileFormatMap.get(props.language),
      lineNumbers: "off",
      roundedSelection: false,
      scrollBeyondLastLine: false,
      readOnly: false,
      minimap: {
        enabled: false,
      },
      theme: "vs",
    });

    editor.getModel()?.onDidChangeContent((e) => {
      emits("change", editor.getModel()?.getValue() ?? "");
    })
});

onUpdated(async () => {
  const model = editor.getModel();
  editor.setValue(await props.fileContent);

  if (model && props.fileContent) {
    monacoEditor.editor.setModelLanguage(model, fileFormatMap.get(props.language) ?? "plaintext");
  }
});

async function saveFile() {
  emits("save", editor.getValue());
}

</script>

<style scoped>
#editor.container {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  height: 100%;
}
</style>