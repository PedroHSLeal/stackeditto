<template>
  <template v-if="isMarkdown">
    <ProsemirrorContainer>
      <ProsemirrorActionMenu :actions="defaultTopMenuActions" />
      <ProsemirrorEditor :value="fileValue" style="flex-grow: 1" />
    </ProsemirrorContainer>
  </template>
  <template v-else-if="!isMarkdown && (fileValue && fileExtension)">
    <MonacoEditor :value="fileValue" :extension="fileExtension" />
  </template>
</template>
<script setup lang="ts">
import { computed, onBeforeUpdate, onMounted, onUpdated, shallowRef } from 'vue';

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

onMounted(async () => await updateFile());
onUpdated(async () => await updateFile());
</script>