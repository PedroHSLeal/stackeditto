<template>
  <div id="files" class="container">
    <div id="files-list">
      <p v-for="file in directory" @click="selectFile(file)">
        {{ file.name }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CustomFile } from '@/models/file';
import { onMounted } from 'vue';

onMounted(() => { });

const props = defineProps<{ directory: CustomFile[] }>();
const emits = defineEmits<{ (e: "onSelect", file: CustomFile): void }>()

async function selectFile(file: CustomFile) {
  emits("onSelect", file);
}
</script>

<style scoped>
#files.container {
  height: 100%;
  overflow: auto;
}

#files-list>p {
  white-space: nowrap;
}

#files-list>p:hover {
  background-color: lightgreen;
  
}
</style>