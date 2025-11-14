<template>
  <div id="file" @click="emits('clicked')">
      <span>
        <Icon icon="material-symbols:lab-profile-rounded" />
        <span>{{ fileName }}</span>
      </span>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";

import type { CustomFile } from "@/models/file";

defineProps<{ fileName: string }>();

const emits = defineEmits<{ (e: "clicked"): void }>();
</script>

<style scoped lang="scss">
#file {
  white-space: nowrap;
  display: flex;
  width: auto;
}

#file>span {
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 4px;
  padding: 0 4px 0 2px;
  transition: background-color 100ms;
}

#file>span:hover {
  background-color: lightgreen;
  cursor: pointer;
}
</style>