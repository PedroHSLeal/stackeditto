<template>
  <Modal>
    <div style="display: grid; grid-template-columns: 20% 1fr; grid-template-rows: 24px 1fr; height: 700px; width: 900px; background-color: white" @click.prevent.stop="">
      <Topbar>
        <button v-if="fileTempContent" @click="saveAndReload">Salvar</button>
      </Topbar>
      <Files @onSelect="selectFile" :directory="extensionFolder" />
      <Editor v-if="fileContent" :fileContent="fileContent" language="js" @change="(c) => fileTempContent = c" />
    </div>
  </Modal>
</template>

<script setup lang="ts">
import Modal from '../Modal.vue';
import Files from '../Files.vue';
import Editor from '../Editor.vue';
import Topbar from '../Topbar.vue';
import type { CustomFile } from '@/models/file';
import { ref } from 'vue';
import { useFileSystem } from '@/services/file-system';

const selectedFile = ref<FileSystemFileHandle>();
const fileContent = ref<string>("");
const fileTempContent = ref<string>("");

const props = defineProps<{ extensionFolder: CustomFile[] }>();
const emits = defineEmits<{ (e: "close"): void }>();

const fs = useFileSystem();

async function selectFile(file: CustomFile) {
  fileContent.value = await file.text();
  selectedFile.value = await file.directoryHandle.getFileHandle(file.name);
}

async function saveAndReload() {
  if (!selectedFile.value) return;

  await fs.saveFile(selectedFile.value, fileTempContent.value);

  emits("close");
}
</script>

<style scoped>
#topbar {
  grid-column: 1 / 3;
}
</style>