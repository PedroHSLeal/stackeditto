<template>
  <div style="width: 100vw; overflow: auto; height: 100vh">
    <h1>PG - Untrusted code imports</h1>
  </div>
</template>

<script setup lang="ts">
import { onBeforeMount } from 'vue';
import { useUntrustedScripts } from '@/services/untrusted-code-extensions/scripts';

import untrustedCodeImports from './untrusted-code-template.js?raw';
import exampleModule from './example-module.mjs?raw';
import { getModule, registerUntrustedModule } from '@/services/untrusted-code-extensions/registry/module';

const { loadUntrustedScript } = useUntrustedScripts();

onBeforeMount(async () => {
  registerUntrustedModule("example-module.mjs", exampleModule);

  await loadUntrustedScript(`return async function(getModule) { ${untrustedCodeImports} }`, getModule);
})

</script>