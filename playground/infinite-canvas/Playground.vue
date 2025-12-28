<template>
  <div style="display: flex; height: 100vh">
    <ProsemirrorEditor :value="fileKey" class="fancy-scroll" style="overflow: auto" />
  </div>
</template>

<script setup lang="ts">
import ProsemirrorEditor from "@/components/editors/prosemirror/Editor.vue";

import { onMounted, ref } from 'vue';
import { useUntrustedScripts } from "@/services/untrusted-code-extensions/scripts";

import { registerUntrustedHtmlBlock } from "@/services/untrusted-code-extensions/registry/html-blocks";
import { useOpenFiles } from "@/services/opened-files";

import canvasExtension from './infinite-canvas.js?raw';
import sampleFile from './canvas.md?raw';

const fileKey = ref("");

const { loadUntrustedScript } = useUntrustedScripts();
const of = useOpenFiles();

onMounted(async () => {
  await loadUntrustedScript(`return async function(registerHtmlBlock) { ${canvasExtension} }`, registerUntrustedHtmlBlock);

  // of.setFile("canvas", { text: () => Promise.resolve(sampleFile) } as any);
  fileKey.value = "canvas";
});
</script>