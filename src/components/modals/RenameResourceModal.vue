<template>
  <Modal>
    <div style="background-color: white; display: flex; flex-direction: column; gap: 12px; width: 900px; border-radius: 10px; padding: 12px">
      <h2 v-if="isFileOperation" style="margin: 0; flex: 1 0 auto">Renomear Arquivo:</h2>
      <h2 v-else-if="isDirectoryOperation" style="margin: 0; flex: 1 0 auto">Renomear Pasta:</h2>
      <div id="entry-text" style="display: flex; gap: 8px; height: 24px;">
        <span v-if="isFileOperation" style="flex: 1 0 auto">Novo Arquivo:</span>
        <span v-else-if="isDirectoryOperation" style="flex: 1 0 auto">Nova Pasta:</span>
        <input v-model="input" :placeholder="isFileOperation ? 'example.txt' : 'example-folder'" style="width: 100%" type="text" name="entry" id="entry">
      </div>
      <div id="operations" style="height: 22px; display: flex; gap: 6px; align-items: center; justify-content: space-between">
        <div id="buttons" style="display: flex; gap: 6px; flex: 1 0 auto; justify-content: flex-end;">
          <button @click="emits('onCancel')" style="background-color: lightslategray">Cancelar</button>
          <button :disabled="isInputValid" @click="onSave" style="background-color: lightgreen">Salvar</button>
        </div>
      </div>
    </div>
  </Modal>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { ModalOperation } from '@/models/file';
import type { CustomDirectory } from '@/models/file';

import Modal from '../Modal.vue';

const PATTERN = /^(?:[a-zA-Z0-9\.\_\-\~\(\)\[\]\{\}\;\,\!\s]+)$/;

const props = defineProps<{ resourceName: string; operation: ModalOperation }>();
const emits = defineEmits<{ (e: "onCancel"): void, (e: "onConfirm", operation: ModalOperation, name: string): void }>();

const input = ref<string>("");

const isInputValid = computed(() => !PATTERN.test(input.value));
const isFileOperation = computed(() => props.operation == ModalOperation.FILE);
const isDirectoryOperation = computed(() => props.operation == ModalOperation.DIRECTORY);

onMounted(() => { input.value = props.resourceName });

function onSave() {
  emits('onConfirm', props.operation, input.value);
}

</script>