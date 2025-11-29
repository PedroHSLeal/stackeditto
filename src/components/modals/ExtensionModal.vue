<template>
  <Modal>
    <div style="display: grid; grid-template-columns: 20% 1fr; grid-template-rows: 32px 1fr; height: 90%; width: 90%; background-color: white">
      <Topbar style="height: 32px">
        <button @click="emits('onNewResource', ModalOperation.DIRECTORY)">Nova Pasta</button>
        <button @click="emits('onNewResource', ModalOperation.FILE)">Novo Arquivo</button>
        <button v-if="changedFileValue" @click="saveChangedValue">Salvar</button>
        <div style="margin-left: auto">
          <button @click="emits('onClose')" style="display: flex; align-items: center; justify-content: center; gap: 4px">
            <Icon width="14" height="14" icon="material-symbols:close-rounded" /> Fechar
          </button>
        </div>
      </Topbar>
      <TreeView @onSelectFile="selectFile" :directory="extensionFolder" style="margin: 4px" />
      <MonacoEditor v-if="fileValue" :value="fileValue" extension="js" @change="(changedValue) => changedFileValue = changedValue" @save="saveChangedValue" />
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { shallowRef } from 'vue';

import { Icon } from '@iconify/vue';

import Modal from '../Modal.vue';
import TreeView from '../TreeView/TreeView.vue';
import MonacoEditor from '../editors/monaco/Editor.vue';
import Topbar from '../Topbar.vue';

import { ModalOperation, type CustomDirectory, type CustomFile } from '@/models/file';
import { useFileSystem } from '@/services/file-system';

const selectedFile = shallowRef<FileSystemFileHandle>();
const fileValue = shallowRef<string>("");
const changedFileValue = shallowRef<string>("");

const props = defineProps<{ extensionFolder: CustomDirectory }>();
const emits = defineEmits<{ (e: "onClose"): void, (e: "onConfirm"): void, (e: 'onNewResource', op: ModalOperation): void }>();

const fs = useFileSystem();

async function selectFile(file: CustomFile) {
  fileValue.value = await file.text();
  selectedFile.value = await file.directoryHandle.getFileHandle(file.name);
}

async function saveChangedValue() {
  if (!selectedFile.value) return;

  await fs.saveFile(selectedFile.value, changedFileValue.value);
  emits("onConfirm");
}

</script>

<style scoped>
#topbar {
  grid-column: 1 / 3;
}
</style>