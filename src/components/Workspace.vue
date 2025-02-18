<template>
  <div id="workspace" style="display: flex; flex-direction: column">
    <template v-for="dir, index in directory.directories">
      <span id="directory" @click="showContent[index] = !showContent[index]">
        <Icon :icon="showContent[index] ? 'material-symbols:folder-open' : 'material-symbols:folder'" /> {{ dir.directoryName }}
      </span>
      <div v-if="showContent[index]" style="width: max-content; display: flex; flex-direction: column; padding-left: 8px">
        <span v-for="file in dir.files" id="file" @click="selectFile(file)">
          <Icon icon="material-symbols:lab-profile-rounded" /> {{ file.name }}
        </span>
        <Workspace @onSelect="selectFile" :directory="dir" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import type { CustomDirectory, CustomFile } from '@/models/file';
import { onMounted, ref, watch } from 'vue';

onMounted(() => { });

const props = defineProps<{ directory: CustomDirectory }>();
const emits = defineEmits<{ (e: "onSelect", file: CustomFile): void }>();

const showContent = ref<boolean[]>([]);

async function selectFile(file: CustomFile) {
  emits("onSelect", file);
}

watch(() => props.directory, (newV, oldV) => {
  newV.directories.forEach(() => showContent.value.push(false));
}, { immediate: true });
</script>

<style scoped>


#directory,#file {
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
  width: auto;
}

#directory:hover {
  background-color: lightpink;
}

#file:hover {
  background-color: lightgreen;
}
</style>