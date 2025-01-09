<template>
  <div style="display: grid; grid-template-columns: 15% 1fr 1fr; height: 100vh; overflow: hidden;">
    <Files @onSelect="selectFile" @populateDirectory="populateDirectory" :directory="directory" />
    <Editor v-if="fileContent && fileExtension" :path="filePath" :fileContent="fileContent" :language="fileExtension" @save="saveAndReload" @change="reloadPreview" />
    <Preview v-if="filePreview" :content="filePreview" />
  </div>
</template>

<script setup lang="ts">

import { computed, onMounted, ref } from 'vue';
import Files from './components/Files.vue';
import Editor from './components/Editor.vue';
import Preview from './components/Preview.vue';
import type { CustomFile } from './models/file';
import { useFileSystem } from './services/file-system';
import { useOriginPrivateFileSystem } from './services/origin-private-file-system';

const selectedFile = ref<FileSystemFileHandle>();
const directory = ref<CustomFile[]>([]);

const filePath = ref<string>("");
const fileContent = ref<string>("");
const filePreview = ref<string>("");
const fileExtension = ref<string>("");

const { populateDirectory, repopulateDirectory, verifyPermission, saveFile } = useFileSystem(directory);

onMounted(() => {
});

async function saveAndReload(fileState: string) {
  if (!selectedFile.value) return;
  
  await saveFile(selectedFile.value, fileState)
  await repopulateDirectory();
}

async function selectFile(file: CustomFile) {
  filePath.value = file.webkitRelativePath;
  fileContent.value = await file.text();
  filePreview.value = await file.text();
  fileExtension.value = file.name.split(".")[1];

  selectedFile.value = await file.directoryHandle.getFileHandle(file.name)
}

async function reloadPreview(fileTempContent: string) {
  filePreview.value = fileTempContent;
}

</script>

<style scoped>
</style>