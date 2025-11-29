<template>
  <template v-if="isMarkdown">
    <ProsemirrorContainer>
      <ProsemirrorEditor :value="fileValue" />
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
import MonacoEditor from './editors/monaco/Editor.vue';

import type { CustomFile } from '@/models/file';

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