<template>
  <Modal>
    <div ref="container" style="display: grid; grid-template-columns: 20% 1fr; grid-template-rows: 32px 1fr; height: 90%; width: 90%; background-color: white">
      <Topbar style="height: 32px">
        <button @click="emits('onTriggerNewFileOrDirectoryModal', ModalOperation.DIRECTORY)">Nova Pasta</button>
        <button @click="emits('onTriggerNewFileOrDirectoryModal', ModalOperation.FILE)">Novo Arquivo</button>
        <button v-if="fileTempContent" @click="saveAndReload">Salvar</button>
        <div style="margin-left: auto">
          <button @click="emits('onClose')" style="display: flex; align-items: center; justify-content: center; gap: 4px">
            <Icon width="14" height="14" icon="material-symbols:close-rounded" /> Fechar
          </button>
        </div>
      </Topbar>
      <TreeView @onSelectFile="selectFile" :directory="extensionFolder" style="margin: 4px" />
      <MonacoEditor v-if="fileContent != null" :value="fileContent" :size="{ width: editorSize.width, height: editorSize.height }" extension="js" @change="(c) => fileTempContent = c" @save="saveAndReload" />
    </div>
  </Modal>
</template>

<script setup lang="ts">
import Modal from '../Modal.vue';
import TreeView from '../TreeView/TreeView.vue';
import MonacoEditor from '../editors/monaco/Editor.vue';
import Topbar from '../Topbar.vue';
import { ModalOperation, type CustomDirectory, type CustomFile } from '@/models/file';
import { computed, reactive, ref } from 'vue';
import { useFileSystem } from '@/services/file-system';
import { useElementBounding } from '@vueuse/core';
import { Icon } from '@iconify/vue/dist/iconify.js';

const container = ref<HTMLElement>();
const containerBoundingRect = reactive(useElementBounding(container));

const editorSize = computed(() => ({ width: containerBoundingRect.width - (containerBoundingRect.width * 0.2), height: containerBoundingRect.height - 32 }));

const selectedFile = ref<FileSystemFileHandle>();
const fileContent = ref<string | null>(null);
const fileTempContent = ref<string | null>(null);

const props = defineProps<{ extensionFolder: CustomDirectory }>();
const emits = defineEmits<{ (e: "onClose"): void, (e: "onConfirm"): void, (e: 'onTriggerNewFileOrDirectoryModal', op: ModalOperation): void }>();

const fs = useFileSystem();

async function selectFile(file: CustomFile) {
  fileContent.value = await file.text();
  selectedFile.value = await file.directoryHandle.getFileHandle(file.name);
}

async function saveAndReload() {
  if (!selectedFile.value) return;
  await fs.saveFile(selectedFile.value, fileTempContent.value ?? "");
  emits("onConfirm");
}

</script>

<style scoped>
#topbar {
  grid-column: 1 / 3;
}
</style>