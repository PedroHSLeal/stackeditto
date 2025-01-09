<template>
  <div id="files" class="container">
    <div id="topbar" style="background-color:lightblue; height: 24px; display: flex; align-items: center; padding-left: 8px">
      <button @click="populateDirectory" style="border: 0">Abrir</button>
    </div>
    <div id="files-list">
      <p v-for="file in directory" @click="selectFile(file)">
        {{ file.name }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CustomFile } from '@/models/file';
import { onMounted, ref } from 'vue';

onMounted(() => { });

const props = defineProps<{ directory: CustomFile[] }>();
const emits = defineEmits<{ (e: "onSelect", file: CustomFile): void, (e: "populateDirectory"): void }>()

async function populateDirectory() {
  emits("populateDirectory");
}

async function selectFile(file: CustomFile) {
  emits("onSelect", file);
}
</script>

<style scoped>
#files-list {
  height: calc(100vh - 24px);

  overflow: auto;
}

#files-list>p:hover {
  background-color: lightgreen;
}
</style>