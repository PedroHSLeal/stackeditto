<template>
  <div ref="refEditorContainer" style="width: 100%; height: 100%">
    <div ref="refEditor" style="width: 100%; height: 100%" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUpdated, useTemplateRef, watch } from "vue";
import * as monacoEditor from "monaco-editor";

import declarationFile from "@/services/untrusted-code-extensions/index.d.ts?raw";

let editor: monacoEditor.editor.IStandaloneCodeEditor;

const fileFormatMap = new Map<string, string>([
  ["js", "javascript"],
  ["ts", "typescript"],
  ["html", "html"],
  ["css", "css"],
  ["json", "json"],
]);

const props = defineProps<{ value: string, extension: string, size?: { width: number, height: number } }>();
const emits = defineEmits<{ (e: "change", changedValue: string): void, (e: "save"): void }>();

const refEditor = useTemplateRef("refEditor");
const refEditorContainer = useTemplateRef("refEditorContainer");

onMounted(() => {
  stopPropagationEventsInContainer();

  if (refEditor.value) {
    createMonacoEditor(refEditor.value);
    addJavascriptConfiguration();

    if (editor) {
      editor.addCommand(monacoEditor.KeyMod.CtrlCmd | monacoEditor.KeyCode.KeyS, () => emits("save"));
      editor.getModel()?.onDidChangeContent(() => emits("change", editor.getModel()?.getValue() ?? ""));
      editor.setValue(props.value);
    }
  }
});

onUpdated(() => {
  if (editor) {
    const model = editor.getModel();
    editor.setValue(props.value);

    if (model && props.extension) {
      monacoEditor.editor.setModelLanguage(model, fileFormatMap.get(props.extension) ?? "plaintext");
    }
  }
});

watch(() => props.size, (newSize) => {
  if (!newSize) return;

  if (editor)
    editor.layout({ width: newSize.width, height: newSize.height });
});

function createMonacoEditor(htmlElement: HTMLElement) {
  editor = monacoEditor.editor.create(htmlElement, {
    language: fileFormatMap.get(props.extension),
    largeFileOptimizations: true,
    lineNumbers: "on",
    roundedSelection: false,
    scrollBeyondLastLine: true,
    readOnly: false,
    minimap: {
      enabled: true,
    },
    wordWrap: "off",
    overviewRulerBorder: false,
    dimension: props.size ? { width: props.size.width, height: props.size.height } : undefined,
    automaticLayout: !props.size
  });
}

function stopPropagationEventsInContainer() {
  if (!refEditorContainer.value) return;

  refEditorContainer.value.addEventListener("keydown", (ev) => {
    if (ev.ctrlKey && ev.code == "KeyS") {
      ev.stopPropagation();
    }
  });
}

function addJavascriptConfiguration() {
  monacoEditor.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
    onlyVisible: false,
  });

  monacoEditor.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monacoEditor.languages.typescript.ScriptTarget.Latest,
    allowNonTsExtensions: true,
    allowJs: true,
    jsx: monacoEditor.languages.typescript.JsxEmit.ReactJSX,
  });

  let libUri = "ts:filename/untrusted-code.d.ts";
  let monacoUri = monacoEditor.Uri.parse(libUri);
  if (!monacoEditor.editor.getModel(monacoUri)) {
    monacoEditor.languages.typescript.javascriptDefaults.addExtraLib(declarationFile, libUri);
    monacoEditor.editor.createModel(declarationFile, "typescript", monacoUri);
  }
}

</script>
