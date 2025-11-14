<template>
  <div ref="refEditorContainer" id="editor" class="container">
    <div ref="refEditor" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUpdated, reactive, ref, watch } from "vue";
import * as monacoEditor from "monaco-editor";

import declarationFile from "@/services/untrusted-code-extensions/index.d.ts?raw";

let editor: monacoEditor.editor.IStandaloneCodeEditor;

const fileFormatMap = new Map<string, string>([
  ["md", "markdown"],
  ["js", "javascript"],
  ["ts", "typescript"],
  ["html", "html"],
  ["css", "css"],
  ["json", "json"],
]);

const props = defineProps<{ fileContent: string, language: string, size?: { width: number, height: number } }>();
const emits = defineEmits<{ (e: "change", fileTempContent: string): void, (e: "save"): void }>();

const refEditor = ref<HTMLElement>();
const refEditorContainer = ref<HTMLElement>();

onMounted(async () => {
  if (refEditor.value && props.language) {
    monacoEditor.editor.defineTheme("ire", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {},
    });

    monacoEditor.editor.setTheme("ire");

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

    var libUri = "ts:filename/untrusted-code.d.ts";
    monacoEditor.languages.typescript.javascriptDefaults.addExtraLib(declarationFile, libUri);
    monacoEditor.editor.createModel(declarationFile, "typescript", monacoEditor.Uri.parse(libUri));

    editor = monacoEditor.editor.create(refEditor.value, {
      value: props.fileContent,
      language: fileFormatMap.get(props.language),
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
      automaticLayout: false,
    });
  }

  refEditorContainer.value!.addEventListener("keydown", (ev) => {
    if (ev.ctrlKey && ev.code == "KeyS") {
      ev.stopPropagation();
    }
  })

  editor.addCommand(monacoEditor.KeyMod.CtrlCmd | monacoEditor.KeyCode.KeyS, function () {
    emits("save");
  });

  editor.getModel()?.onDidChangeContent(() => {
    const content = editor.getModel()?.getValue();

    if (props.fileContent !== content)
      emits("change", content ?? "");
  })
});

onUpdated(async () => {
  const model = editor.getModel();
  editor.setValue(props.fileContent);

  if (model && props.fileContent) {
    monacoEditor.editor.setModelLanguage(model, fileFormatMap.get(props.language) ?? "plaintext");
  }
});

watch(() => props.size, (newSize, _) => {
  if (newSize == null || newSize == undefined) return;

  if (editor)
    editor.layout({ width: newSize.width, height: newSize.height });
});

</script>