<template>
  <template v-if="isMarkdown">
    <ProsemirrorContainer>
      <ProsemirrorActionMenu :actions="defaultTopMenuActions" />
      <ProsemirrorEditor :value="fileValue" style="flex-grow: 1" />
    </ProsemirrorContainer>
  </template>
  <template v-else-if="fileValue && fileExtension">
    <MonacoEditor :value="fileValue" :extension="fileExtension" />
  </template>
</template>
<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';

import ProsemirrorEditor from './editors/prosemirror/Editor.vue';
import ProsemirrorContainer from './editors/prosemirror/Container.vue';
import ProsemirrorActionMenu from './editors/prosemirror/TopMenu.vue';
import MonacoEditor from './editors/monaco/Editor.vue';

import type { CustomFile } from '@/models/file-system';
import { defaultTopMenuActions } from '@/models/top-menu';

const props = defineProps<{ value?: CustomFile }>();

const fileValue = shallowRef("");
const fileExtension = shallowRef("");

const isMarkdown = computed(() => fileExtension.value == "md");

async function updateFile() {
  if (props.value) {
    fileValue.value = await props.value.text();
    fileExtension.value = props.value.extensionFile;
  }
}

// lê o arquivo só quando a prop muda (antes, onUpdated relia do disco a cada re-render)
watch(() => props.value, updateFile, { immediate: true });
</script>