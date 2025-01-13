<template>
  <div id="app-container">
    <Topbar>
      <button @click="populateDirectory">Abrir</button>
      <button v-if="fileTempContent" @click="saveAndReload">Salvar</button>
      <button v-if="applicationDirectory.length > 0" @click="() => showExtensionModal = true">Extensoes</button>
    </Topbar>
    <Files @onSelect="selectFile" :directory="directory" />
    <Editor v-if="fileContent && fileExtension" :fileContent="fileContent" :language="fileExtension" @change="reloadPreview" />
    <Preview v-if="fileTempContent" :content="fileTempContent" />
    <ExtensionModal v-if="showExtensionModal" :extensionFolder="applicationDirectory" @close="closeModalAndReload" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import Files from './components/Files.vue';
import Topbar from './components/Topbar.vue';
import Editor from './components/Editor.vue';
import Preview from './components/Preview.vue';

import type { CustomFile } from './models/file';

import { useFileSystem } from './services/file-system';
import ExtensionModal from './components/modals/ExtensionModal.vue';

const selectedFile = ref<FileSystemFileHandle>();

const directory = ref<CustomFile[]>([]);
const applicationDirectory = ref<CustomFile[]>([]);

const fileContent = ref<string>("");
const fileTempContent = ref<string>("");
const fileExtension = ref<string>("");

const showExtensionModal = ref<boolean>(false);

const fs = useFileSystem();

onMounted(() => { });

async function populateDirectory() {
  const result = await fs.populateDirectory();

  if (!result) return;

  directory.value = result?.directory;
  applicationDirectory.value = result?.applicationDirectory;

  await loadScripts();
}

async function saveAndReload() {
  if (!selectedFile.value) return;

  await fs.saveFile(selectedFile.value, fileTempContent.value)

  const result = await fs.repopulateDirectory();

  if (!result) return;

  directory.value = result?.directory;
  applicationDirectory.value = result?.applicationDirectory;
}

async function closeModalAndReload() {
  showExtensionModal.value = false;

  const result = await fs.repopulateDirectory();

  if (!result) return;

  directory.value = result?.directory;
  applicationDirectory.value = result?.applicationDirectory;
}

async function selectFile(file: CustomFile) {
  fileContent.value = await file.text();
  fileTempContent.value = await file.text();
  fileExtension.value = file.name.split(".")[1];
  
  selectedFile.value = await file.directoryHandle.getFileHandle(file.name)
}

async function reloadPreview(tempContent: string) {
  fileTempContent.value = tempContent;
}

async function loadScripts() {
  const loadImports = applicationDirectory.value.find(f => f.name == "imports.js");

  if (loadImports) {
    window.loadImports = new Function(await loadImports.text());
    await window.loadImports();
  }

  const scriptsContent = applicationDirectory.value
    .filter(f => f.name !== "imports.js")
    .map(async (f) => [f.name.split(".")[0], await f.text()]);

  scriptsContent.forEach(async (script) => {
    script.then((s) => window[s[0]] = new Function(s[1]));
  });
}

</script>

<style scoped>
#app-container {
  display: grid;
  overflow: hidden;
  height: 100%;
  grid-template-rows: 24px 1fr;
  grid-template-columns: 250px 800px 1fr;
}

#app-container>#topbar {
  grid-column: 1 / 4;
}
</style>