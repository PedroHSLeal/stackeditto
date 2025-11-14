<template>
  <div id="directory" style="display: flex; flex-direction: column">
    <template v-if="directory" v-for="(dir, index) in directory.directories">
      <DirectoryItem :directory="dir" :selected="showContent[index]" @contextmenu="(e: any) => emits('contextMenu', 'directory', dir, { x: e.clientX, y: e.clientY })" @clicked="() => { showContent[index] = !showContent[index]; emits('onSelectDirectory', dir); }" />
      <TreeView v-if="showContent[index]"
        @onSelectFile="(file) => emits('onSelectFile', file)"
        @onSelectDirectory="(dir) => emits('onSelectDirectory', dir)"
        @contextMenu="(resourceType, resource, coordinates) => emits('contextMenu', resourceType, resource, coordinates)"
        :directory="dir"
        :showFiles="showFiles"
        style="padding-left: 8px" />
    </template>
    <template v-if="directory && showFiles" v-for="(file, _) in directory.files">
      <FileItem :fileName="file.name" @contextmenu="(e: any) => { emits('contextMenu', 'file', file, { x: e.clientX, y: e.clientY }) }" @clicked="emits('onSelectFile', file)" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';

import DirectoryItem from './DirectoryItem.vue';
import FileItem from './FileItem.vue';

import type { CustomDirectory, CustomFile } from '@/models/file';

onMounted(() => { });

const props = withDefaults(defineProps<{ directory: CustomDirectory | null, showFiles?: boolean }>(), { showFiles: (props) => props.showFiles ?? true });
const emits = defineEmits<{
  (e: "onSelectFile", file: CustomFile): void,
  (e: "onSelectDirectory", directory: CustomDirectory): void,
  (e: "contextMenu", resourceType: "directory" | "file", resource: CustomDirectory | CustomFile, coordinates: { x: number, y: number }): void
}>();

const showContent = reactive<boolean[]>([]);

watch(() => props.directory, (newV, oldV) => {
  if (newV)
    newV.directories.forEach(() => showContent.push(false));
}, { immediate: true });
</script>

<style scoped lang="scss">
#directory,
#file {
  white-space: nowrap;
  display: flex;
  width: auto;
}
</style>