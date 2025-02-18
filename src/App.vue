<template>
  <div id="app-container">
    <Topbar>
      <button @click="populateDirectory">Abrir</button>
      <button v-if="fileTempContent" @click="saveAndReload">Salvar</button>
      <button v-if="anyApplication" @click="() => showExtensionModal = true">Extensoes</button>
    </Topbar>
    <Workspace style="height: 100%; overflow: auto" @onSelect="selectFile" :directory="directory" />
    <Editor v-if="fileContent && fileExtension" :fileContent="fileContent" :language="fileExtension" @change="reloadPreview" />
    <Preview v-if="fileTempContent" :content="fileTempContent" />
    <ExtensionModal v-if="showExtensionModal" :extensionFolder="applicationDirectory" @close="closeModalAndReload" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import Workspace from './components/Workspace.vue';
import Topbar from './components/Topbar.vue';
import Editor from './components/Editor.vue';
import Preview from './components/Preview.vue';
import ExtensionModal from './components/modals/ExtensionModal.vue';

import type { CustomDirectory, CustomFile } from './models/file';

import { useFileSystem } from './services/file-system';
import { useExtensions } from './services/extension';

const selectedFile = ref<FileSystemFileHandle>();

const directory = ref<CustomDirectory>({ directoryName: "", files: [], directories: [] });

const applicationDirectory = ref<CustomDirectory>({ directoryName: "", files: [], directories: [] });
const anyApplication = computed(() => applicationDirectory.value.files.length > 0 || applicationDirectory.value.directories.length > 0)

const fileContent = ref<string>("");
const fileTempContent = ref<string>("");
const fileExtension = ref<string>("");

const showExtensionModal = ref<boolean>(false);

const fs = useFileSystem();
const { loadScripts } = useExtensions();

onMounted(() => { });

async function populateDirectory() {
  await fs.openDirectory();
  const project = await fs.populateDirectory(fs.directoryStructure.value);
  if (!project) return;
  
  await changeRefs(project);
  // await loadScripts(project.applicationDirectory);
}

async function saveAndReload() {
  if (!selectedFile.value) return;

  await fs.saveFile(selectedFile.value, fileTempContent.value);
  await fs.reopenDirectory();
  await changeRefs(await fs.repopulateDirectory(fs.directoryStructure.value));
}

async function closeModalAndReload() {
  showExtensionModal.value = false;

  await changeRefs(await fs.populateDirectory(fs.directoryStructure.value));
}

async function selectFile(file: CustomFile) {
  fileContent.value = await file.text();
  fileTempContent.value = await file.text();
  fileExtension.value = file.extensionFile;

  selectedFile.value = await file.directoryHandle.getFileHandle(file.name);
}

async function reloadPreview(tempContent: string) {
  fileTempContent.value = tempContent;
}

async function changeRefs(directoryResult: Awaited<ReturnType<typeof fs.populateDirectory>> ) {
  if (!directoryResult) return;

  const { directory: fsDirectory, applicationDirectory: fsApplicationDirectory } = directoryResult;

  directory.value = fsDirectory;
  applicationDirectory.value = fsApplicationDirectory;
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