<template>
  <Modal>
    <div style="background-color: white; display: flex; flex-direction: column; gap: 12px; width: 900px; border-radius: 10px; padding: 12px">
      <h2 v-if="isFileOperation" style="margin: 0; flex: 1 0 auto">Excluir Arquivo:</h2>
      <h2 v-else-if="isDirectoryOperation" style="margin: 0; flex: 1 0 auto">Excluir Pasta:</h2>
      <div id="entry-text" style="display: flex; gap: 8px;">
        <Icon width="72" height="72" icon="material-symbols:delete-forever-outline" color="red"/>
        <span style="width: 100%; align-self: center;">
          Tem certeza que gostaria de excluir {{ resourceName }}?
        </span>
      </div>
      <div id="operations" style="height: 22px; display: flex; gap: 6px; align-items: center; justify-content: space-between">
        <div id="buttons" style="display: flex; gap: 6px; flex: 1 0 auto; justify-content: flex-end;">
          <button @click="emits('onCancel')" style="background-color: lightslategray">Cancelar</button>
          <button @click="onConfirm" style="background-color: lightcoral">Excluir</button>
        </div>
      </div>
    </div>
  </Modal>
</template>
<script setup lang="ts">
import { computed } from 'vue';

import { Icon } from "@iconify/vue";

import { ModalOperation } from '@/models/file-system';

import Modal from '../Modal.vue';

const props = defineProps<{ operation: ModalOperation }>();
const emits = defineEmits<{ (e: "onCancel"): void, (e: "onConfirm", operation: ModalOperation): void }>();

const resourceName = computed(() => isFileOperation.value ? "esse arquivo" : "essa pasta e seus conteúdos");
const isFileOperation = computed(() => props.operation == ModalOperation.FILE);
const isDirectoryOperation = computed(() => props.operation == ModalOperation.DIRECTORY);

function onConfirm() {
  emits('onConfirm', props.operation);
}

</script>