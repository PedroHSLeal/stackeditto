<template>
  <div style="width: 100vw; overflow: auto; height: 100vh">
    <h1>PG - Untrusted custom elements</h1>
    <ProsemirrorEditor v-if="showEditor" :value="file" />
  </div>
</template>

<script setup lang="ts">
import ProsemirrorEditor from '@/components/editors/prosemirror/Editor.vue';

import { onBeforeMount, onMounted, shallowRef } from 'vue';
import { useUntrustedScripts } from '@/services/untrusted-code-extensions/scripts';

import untrustedCustomElementsV1 from './untrusted-custom-elements--v1.js?raw';
import untrustedCustomElementsV2 from './untrusted-custom-elements--v2.js?raw';
import untrustedCustomElementsV3 from './untrusted-custom-elements--v3.js?raw';
import sampleFile from './sample-file.md?raw';
import { registerUntrustedHtmlBlock } from '@/services/untrusted-code-extensions/registry/html-blocks';

const { loadUntrustedScript } = useUntrustedScripts();

const file = shallowRef(sampleFile);
const showEditor = shallowRef(false);

onBeforeMount(async () => {
  // /* v1 */ loadUntrustedScript(untrustedCustomElementsV1, registerUntrustedHtmlBlock)
  // /* v2 */ loadUntrustedScript(`return function(registerHtmlBlock) { ${untrustedCustomElementsV2} }`, registerUntrustedHtmlBlock)
  /* v3 */ loadUntrustedScript(`return async function(registerHtmlBlock) { ${untrustedCustomElementsV3} }`, registerUntrustedHtmlBlock)
    .then(() => {
      console.log("executando promise resolvida!");
      showEditor.value = true;
    });
});
</script>