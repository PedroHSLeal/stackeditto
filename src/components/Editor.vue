<template>
  <div id="editor" class="container">
    <div ref="refEditor" style="height: 100%" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUpdated, ref } from "vue";
import * as monacoEditor from "monaco-editor"

let editor: monacoEditor.editor.IStandaloneCodeEditor;

const fileFormatMap = new Map<string, string>([
  ["md", "markdown"],
  ["js", "javascript"],
  ["ts", "typescript"],
  ["html", "html"],
  ["css", "css"],
  ["json", "json"],
]);

const props = defineProps<{ fileContent: string, language: string }>();
const emits = defineEmits<{ (e: "change", fileTempContent: string): void }>();

const refEditor = ref<HTMLElement>();

onMounted(async () => {
  if (refEditor.value && props.fileContent && props.language) {
    monacoEditor.editor.defineTheme("ire", {
      base: "hc-light",
      inherit: true,
      rules: [],
      colors: {
        // "focusBorder": "transparent",
        // "contrastBorder": "#fff",
        // "scrollbar.shadow": "#fff",
        // "scrollbarSlider.background": "#fff", // Slider background color.
        // "scrollbarSlider.hoverBackground": "#fff", // Slider background color when hovering.
        // "scrollbarSlider.activeBackground": "#fff"
      },
    });

    monacoEditor.editor.setTheme("ire");

    editor = monacoEditor.editor.create(refEditor.value, {
      value: await props.fileContent,
      language: fileFormatMap.get(props.language),
      lineNumbers: "off",
      roundedSelection: false,
      scrollBeyondLastLine: true,
      readOnly: false,
      minimap: {
        enabled: false,
      },
      wordWrap: "off",
      overviewRulerBorder: false,
    });
  }

  editor.getModel()?.onDidChangeContent(() => {
    const content = editor.getModel()?.getValue();

    console.log(content?.length, props.fileContent.length);

    if (props.fileContent !== content)
      emits("change", content ?? "");
  })
});

onUpdated(async () => {
  const model = editor.getModel();
  editor.setValue(await props.fileContent);

  if (model && props.fileContent) {
    monacoEditor.editor.setModelLanguage(model, fileFormatMap.get(props.language) ?? "plaintext");
  }
});

</script>

<style scoped>
/* #editor.container {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  height: 100%;
} */
</style>